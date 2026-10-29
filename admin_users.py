"""Server-only employee provisioning. No browser session is created or replaced."""

import logging
import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from supabase_auth.errors import AuthApiError

from api_auth import AuthenticatedUser, require_admin

logger = logging.getLogger(__name__)


class SafeValidationRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def safe_handler(request):
            try:
                return await handler(request)
            except RequestValidationError:
                # FastAPI's default errors include input values, even for secrets.
                return JSONResponse(status_code=422, content={"detail": "Dados de cadastro inválidos."})

        return safe_handler


class EmployeeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    name: str = Field(min_length=1, max_length=120, strict=True)
    email: str = Field(min_length=3, max_length=254, strict=True)
    password: SecretStr = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()
        if not value or any(ord(character) < 32 or ord(character) == 127 for character in value):
            raise ValueError("Nome inválido.")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        value = value.strip().lower()
        # Deliberately accept common ASCII mailbox syntax; no extra dependency.
        if len(value) > 254 or value.count("@") != 1:
            raise ValueError("E-mail inválido.")
        local, domain = value.split("@")
        if (not 1 <= len(local) <= 64 or local.startswith(".") or local.endswith(".")
                or ".." in local or not re.fullmatch(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+", local)):
            raise ValueError("E-mail inválido.")
        labels = domain.split(".")
        if len(labels) < 2 or any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in labels):
            raise ValueError("E-mail inválido.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        password = value.get_secret_value()
        if not password.strip() or any(ord(character) < 32 or ord(character) == 127 for character in password):
            raise ValueError("Senha inválida.")
        return value


class EmployeeCreated(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    name: str
    role: str = "employee"
    status: str = "active"


class AdminUserRead(BaseModel):
    """The only account fields the administrative directory may expose."""
    model_config = ConfigDict(extra="forbid")
    id: UUID
    name: str
    email: str
    role: Literal["admin", "employee"]
    status: Literal["active", "inactive"]
    created_at: datetime


class AdminUsersPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    users: list[AdminUserRead]
    page: int
    per_page: int
    total: int


router = APIRouter(prefix="/api/admin", route_class=SafeValidationRoute,
                   dependencies=[Depends(require_admin)])

AUTH_SCAN_PAGE_SIZE = 100
MAX_DIRECTORY_USERS = 1000


class DirectoryInconsistencyError(Exception):
    """Auth and profile records cannot safely be presented as one directory."""


def profile_rows(client, user_id):
    rows = (client.schema("public").table("profiles").select("id,name,role,status")
            .eq("id", user_id).limit(2).execute()).data
    if not isinstance(rows, list):
        raise ValueError("Invalid profile response")
    return rows


def compensate_new_auth_user(client, user_id, actor_id):
    """Delete only this request's confirmed new UUID, with no existing profile.

    If insertion may have committed, or checking fails, preserve the account for
    reconciliation rather than risk a cascading delete of an existing profile.
    """
    if user_id == actor_id:
        logger.error("employee_creation_reconciliation_required")
        return
    try:
        if profile_rows(client, user_id):
            logger.error("employee_creation_reconciliation_required")
            return
        client.auth.admin.delete_user(user_id)
        logger.warning("employee_creation_compensated")
    except Exception:
        # Never log SDK exceptions, payloads, UUIDs, emails or Auth responses.
        logger.error("employee_creation_reconciliation_required")


def auth_users_by_id(client):
    """Read all Auth pages within a bounded reconciliation window."""
    users = {}
    page = 1
    while True:
        batch = client.auth.admin.list_users(page=page, per_page=AUTH_SCAN_PAGE_SIZE)
        if not isinstance(batch, list) or len(batch) > AUTH_SCAN_PAGE_SIZE:
            raise DirectoryInconsistencyError()
        for auth_user in batch:
            try:
                user_id = str(UUID(str(auth_user.id)))
                email = auth_user.email
                if not isinstance(email, str) or not email:
                    raise ValueError()
            except (AttributeError, TypeError, ValueError):
                raise DirectoryInconsistencyError() from None
            if user_id in users:
                raise DirectoryInconsistencyError()
            users[user_id] = email
            if len(users) > MAX_DIRECTORY_USERS:
                raise DirectoryInconsistencyError()
        if len(batch) < AUTH_SCAN_PAGE_SIZE:
            return users
        page += 1


def profiles_by_id(client):
    """Read the profile directory in bounded PostgREST pages."""
    profiles = {}
    offset = 0
    while True:
        rows = (client.schema("public").table("profiles")
                .select("id,name,role,status,created_at").order("id")
                .range(offset, offset + AUTH_SCAN_PAGE_SIZE - 1).execute()).data
        if not isinstance(rows, list) or len(rows) > AUTH_SCAN_PAGE_SIZE:
            raise DirectoryInconsistencyError()
        for profile in rows:
            if not isinstance(profile, dict):
                raise DirectoryInconsistencyError()
            try:
                user_id = str(UUID(str(profile["id"])))
                name = profile["name"]
                role = profile["role"]
                status = profile["status"]
                created_at = profile["created_at"]
                if (not isinstance(name, str) or not name or role not in {"admin", "employee"}
                        or status not in {"active", "inactive"} or not isinstance(created_at, str)):
                    raise ValueError()
                created_at_value = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except (KeyError, TypeError, ValueError):
                raise DirectoryInconsistencyError() from None
            if user_id in profiles:
                raise DirectoryInconsistencyError()
            profiles[user_id] = {
                "id": user_id, "name": name, "role": role,
                "status": status, "created_at": created_at_value,
            }
            if len(profiles) > MAX_DIRECTORY_USERS:
                raise DirectoryInconsistencyError()
        if len(rows) < AUTH_SCAN_PAGE_SIZE:
            return profiles
        offset += AUTH_SCAN_PAGE_SIZE


@router.get("/users", response_model=AdminUsersPage)
def list_admin_users(
    request: Request,
    page: int = Query(default=1, ge=1, le=40),
    per_page: int = Query(default=25, ge=1, le=100),
    actor: AuthenticatedUser = Depends(require_admin),
):
    """List only fully reconciled Auth/profile pairs for an administrator."""
    del actor  # Authorization was resolved by the dependency; no client role is trusted.
    client = request.app.state.profile_client
    try:
        auth_users = auth_users_by_id(client)
    except DirectoryInconsistencyError:
        logger.warning("admin_users_list_reconciliation_required")
        raise HTTPException(409, "A lista de usuários requer reconciliação administrativa.") from None
    except Exception:
        logger.error("admin_users_list_auth_failed")
        raise HTTPException(502, "Não foi possível consultar os usuários.") from None

    try:
        profiles = profiles_by_id(client)
    except DirectoryInconsistencyError:
        logger.warning("admin_users_list_reconciliation_required")
        raise HTTPException(409, "A lista de usuários requer reconciliação administrativa.") from None
    except Exception:
        logger.error("admin_users_list_profiles_failed")
        raise HTTPException(503, "Não foi possível consultar os usuários.") from None

    if auth_users.keys() != profiles.keys():
        logger.warning("admin_users_list_reconciliation_required")
        raise HTTPException(409, "A lista de usuários requer reconciliação administrativa.")

    records = sorted(
        ({**profile, "email": auth_users[user_id]} for user_id, profile in profiles.items()),
        key=lambda record: (record["created_at"], record["id"]),
    )
    start = (page - 1) * per_page
    return AdminUsersPage(users=records[start:start + per_page], page=page,
                          per_page=per_page, total=len(records))


@router.post("/users", response_model=EmployeeCreated, status_code=201)
def create_employee(body: EmployeeCreate, request: Request,
                    actor: AuthenticatedUser = Depends(require_admin)):
    client = request.app.state.profile_client
    try:
        result = client.auth.admin.create_user({
            "email": body.email, "password": body.password.get_secret_value(),
            # Administrative confirmation, NOT proof of email ownership.
            "email_confirm": True,
        })
    except AuthApiError as error:
        if error.code in {"email_exists", "user_already_exists"}:
            raise HTTPException(409, "Já existe uma conta com este e-mail.") from None
        if error.code == "weak_password":
            raise HTTPException(422, "A senha não atende à política de segurança.") from None
        logger.error("employee_creation_auth_failed")
        raise HTTPException(502, "Não foi possível criar o funcionário.") from None
    except Exception:
        # A timeout may follow a successful remote commit: don't guess an ID.
        logger.error("employee_creation_auth_outcome_unknown")
        raise HTTPException(502, "Não foi possível criar o funcionário.") from None

    try:
        user_id = str(UUID(str(result.user.id)))
        if user_id == actor.id or result.user.email.lower() != body.email:
            raise ValueError("Unverified new identity")
    except Exception:
        logger.error("employee_creation_reconciliation_required")
        raise HTTPException(502, "Não foi possível confirmar o cadastro do funcionário.") from None

    try:
        existing = profile_rows(client, user_id)
    except Exception:
        logger.error("employee_creation_reconciliation_required")
        raise HTTPException(500, "Não foi possível concluir o cadastro do funcionário.") from None
    if existing:
        # Never overwrite or cascade-delete a preexisting profile.
        logger.error("employee_creation_reconciliation_required")
        raise HTTPException(500, "Não foi possível concluir o cadastro do funcionário.")

    profile = {"id": user_id, "name": body.name, "role": "employee", "status": "active"}
    try:
        rows = client.schema("public").table("profiles").insert(profile).execute().data
        if not isinstance(rows, list) or len(rows) != 1 or any(rows[0].get(key) != value for key, value in profile.items()):
            raise ValueError("Invalid profile creation response")
    except Exception:
        compensate_new_auth_user(client, user_id, actor.id)
        raise HTTPException(500, "Não foi possível concluir o cadastro do funcionário.") from None

    return EmployeeCreated(**profile)
