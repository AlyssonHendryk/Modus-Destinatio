"""Administrative, read-only audit listing with signed keyset cursors."""

import base64
import hashlib
import hmac
import json
import logging
import re
import time
from datetime import datetime, timezone
from enum import Enum
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from postgrest.exceptions import APIError
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from typing import Literal

from api_auth import AuthenticatedUser, require_admin


logger = logging.getLogger(__name__)


def log_rpc_failure(error: Exception) -> None:
    # Log identifiers only, never the exception text, traceback or RPC payload.
    exception_class = type(error).__name__
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,79}", exception_class):
        exception_class = "Exception"
    code = getattr(error, "code", None)
    if not isinstance(code, str) or not re.fullmatch(r"(?:[0-9A-Z]{5}|PGRST[0-9]{3})", code):
        code = "unavailable"
    logger.error("activity_logs_rpc_failed exception_class=%s code=%s", exception_class, code)


class ActivityAction(str, Enum):
    order_created = "order.created"
    order_updated = "order.updated"
    order_deleted = "order.deleted"
    separation_started = "order.separation_started"
    separation_completed = "order.separation_completed"
    product_created = "product.created"
    product_updated = "product.updated"
    product_deleted = "product.deleted"
    stock_adjusted = "stock.adjusted"
    profile_name_updated = "profile.name_updated"
    employee_status_updated = "employee.status_updated"
    creation_requested = "employee.creation_requested"
    employee_created = "employee.created"
    creation_failed = "employee.creation_failed"
    creation_unknown = "employee.creation_outcome_unknown"
    deletion_requested = "employee.deletion_requested"
    employee_deleted = "employee.deleted"
    deletion_failed = "employee.deletion_failed"
    deletion_unknown = "employee.deletion_outcome_unknown"


class ActivityEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int = Field(gt=0, strict=True)
    occurred_at: datetime
    actor_id: UUID
    actor_role: Literal["admin", "employee"]
    action: ActivityAction
    entity_type: Literal["order", "product", "profile"]
    entity_id: str | None
    request_id: UUID
    details: dict


class ActivityPage(BaseModel):
    events: list[ActivityEvent]
    next_cursor: str | None
    has_more: bool


router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])


def derive_cursor_key(server_secret: str) -> bytes:
    # Reuse the existing backend-only credential with domain separation.
    # Stable across workers/restarts sharing that credential; rotation expires
    # old cursors. Never include this credential in the cursor or response.
    return hmac.new(server_secret.encode(), b"modus/activity-cursor/v1", hashlib.sha256).digest()


def utc_text(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timezone required")
    return value.astimezone(timezone.utc).isoformat(timespec="microseconds")


def encode_cursor(payload: dict, key: bytes) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    signature = hmac.new(key, raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(raw + signature).rstrip(b"=").decode()


def decode_cursor(token: str, key: bytes, scope: dict) -> dict:
    try:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", token):
            raise ValueError()
        raw = base64.b64decode(token + "=" * (-len(token) % 4), altchars=b"-_", validate=True)
        if len(raw) <= 32:
            raise ValueError()
        body, signature = raw[:-32], raw[-32:]
        if not hmac.compare_digest(signature, hmac.new(key, body, hashlib.sha256).digest()):
            raise ValueError()
        payload = json.loads(body)
        if set(payload) != {"v", "scope", "as_of", "before_at", "before_id", "expires"}:
            raise ValueError()
        if payload["v"] != 1 or payload["scope"] != scope:
            raise ValueError()
        if type(payload["expires"]) is not int or payload["expires"] <= time.time():
            raise ValueError()
        if type(payload["before_id"]) is not int or not 0 < payload["before_id"] <= 9223372036854775807:
            raise ValueError()
        before = datetime.fromisoformat(payload["before_at"])
        anchor = datetime.fromisoformat(payload["as_of"])
        if utc_text(before) != payload["before_at"] or utc_text(anchor) != payload["as_of"] or before > anchor:
            raise ValueError()
        return payload
    except (ValueError, TypeError, KeyError, UnicodeError, OverflowError):
        raise HTTPException(422, "Cursor inválido, expirado ou incompatível com os filtros.") from None


SCALAR_FIELDS = {
    "order.created": {"operation", "status", "item_count", "total"},
    "order.deleted": {"operation", "status", "item_count", "total"},
    "order.separation_started": {"previous_status", "new_status"},
    "order.separation_completed": {"previous_status", "new_status"},
    "product.created": {"name", "initial_quantity", "min", "max", "unit_price", "active"},
    "product.deleted": {"name", "quantity", "active"},
    "stock.adjusted": {"delta", "previous_quantity", "new_quantity"},
    "employee.creation_requested": set(),
    "employee.created": {"name", "role", "status"},
    "employee.deletion_requested": {"previous_status"},
    "employee.deleted": {"previous_status"},
}
CHANGE_FIELDS = {
    "order.updated": {"supplier", "customer", "operation", "status", "date", "total", "stock_applied"},
    "product.updated": {"name", "min", "max", "unit_price", "active"},
    "profile.name_updated": {"name"},
    "employee.status_updated": {"status"},
}
AUTH_STAGES = {"auth_create", "auth_delete", "identity_check", "profile_lookup", "profile_insert", "compensation", "deletion_confirmation"}
AUTH_REASONS = {"account_exists", "weak_password", "auth_rejected", "profile_write_failed", "timeout", "remote_outcome_unknown", "response_unverified", "lookup_failed", "preexisting_profile", "profile_write_outcome_unknown", "compensation_unconfirmed", "confirmation_failed", "profile_still_present"}


def scalar(value):
    return value is None or type(value) in (str, int, float, bool)


def public_details(action: str, details: dict) -> dict:
    """Response allowlists prevent accidental disclosure of extra JSON keys."""
    if type(details.get("schema_version")) is not int or details["schema_version"] != 1:
        raise ValueError("Unsupported details version")
    result = {"schema_version": 1}
    for field in SCALAR_FIELDS.get(action, set()):
        if field in details and scalar(details[field]):
            result[field] = details[field]
    if action in CHANGE_FIELDS:
        changes = details.get("changes")
        if not isinstance(changes, dict):
            raise ValueError("Invalid changes")
        result["changes"] = {
            field: {"before": change["before"], "after": change["after"]}
            for field, change in changes.items()
            if field in CHANGE_FIELDS[action] and isinstance(change, dict)
            and "before" in change and "after" in change
            and scalar(change["before"]) and scalar(change["after"])
        }
    if action == "order.updated":
        if not isinstance(details.get("item_changes"), list):
            raise ValueError("Invalid item changes")
        result["item_changes"] = []
        for event in details["item_changes"]:
            if not isinstance(event, dict) or event.get("kind") not in ("added", "removed") or not isinstance(event.get("item"), dict):
                raise ValueError("Invalid item event")
            result["item_changes"].append({"kind": event["kind"], "item": {
                field: value for field, value in event["item"].items()
                if field in {"product_id", "product", "quantity", "unit_price"} and scalar(value)
            }})
    if action.endswith(("_failed", "_outcome_unknown")):
        if details.get("stage") not in AUTH_STAGES or details.get("reason_code") not in AUTH_REASONS:
            raise ValueError("Unrecognized Auth metadata")
        result.update(stage=details["stage"], reason_code=details["reason_code"])
        if details.get("compensation_result") in {"succeeded", "unknown", "not_attempted"}:
            result["compensation_result"] = details["compensation_result"]
    return result


@router.get("/activity-logs", response_model=ActivityPage)
def list_activity_logs(
    request: Request,
    user_id: UUID | None = None,
    action: ActivityAction | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(default=None, min_length=1, max_length=4096),
    actor: AuthenticatedUser = Depends(require_admin),
):
    try:
        lower = utc_text(date_from) if date_from else None
        upper = utc_text(date_to) if date_to else None
        if date_from and date_to and date_from >= date_to:
            raise ValueError()
    except ValueError:
        raise HTTPException(422, "Informe um período válido com datas e fuso horário.") from None
    scope = {"actor_id": actor.id, "user_id": str(user_id) if user_id else None,
             "action": action.value if action else None, "date_from": lower, "date_to": upper, "limit": limit}
    key = request.app.state.activity_cursor_key
    state = decode_cursor(cursor, key, scope) if cursor else {
        "v": 1, "scope": scope, "as_of": utc_text(datetime.now(timezone.utc)),
        "before_at": None, "before_id": None, "expires": int(time.time()) + 3600,
    }
    try:
        rows = request.app.state.profile_client.rpc("audit_list_activity_logs", {
            "p_actor_id": actor.id, "p_user_id": scope["user_id"], "p_action": scope["action"],
            "p_date_from": lower, "p_date_to": upper, "p_limit": limit,
            "p_as_of": state["as_of"], "p_before_at": state["before_at"], "p_before_id": state["before_id"],
        }).execute().data
    except APIError as error:
        log_rpc_failure(error)
        if str(error.code) == "42501":
            raise HTTPException(403, "Esta consulta exige um administrador ativo.") from None
        raise HTTPException(503, "Não foi possível consultar o histórico de atividades.") from None
    except Exception as error:
        log_rpc_failure(error)
        raise HTTPException(503, "Não foi possível consultar o histórico de atividades.") from None
    try:
        if not isinstance(rows, list) or len(rows) > limit + 1:
            raise ValueError()
        events = [ActivityEvent.model_validate(row) for row in rows]
        previous = (datetime.fromisoformat(state["before_at"]), state["before_id"]) if cursor else None
        for event in events:
            position = (event.occurred_at, event.id)
            utc_text(event.occurred_at)
            if previous is not None and position >= previous:
                raise ValueError("Unstable page ordering")
            if event.occurred_at > datetime.fromisoformat(state["as_of"]):
                raise ValueError()
            if (user_id and event.actor_id != user_id) or (action and event.action != action):
                raise ValueError()
            if ((date_from and event.occurred_at < date_from)
                    or (date_to and event.occurred_at >= date_to)):
                raise ValueError()
            event.details = public_details(event.action.value, event.details)
            previous = position
        has_more = len(events) > limit
        events = events[:limit]
        next_cursor = None
        if has_more:
            state.update(before_at=utc_text(events[-1].occurred_at), before_id=events[-1].id)
            next_cursor = encode_cursor(state, key)
        return ActivityPage(events=events, next_cursor=next_cursor, has_more=has_more)
    except (ValueError, TypeError, KeyError, OverflowError, ValidationError):
        raise HTTPException(503, "Resposta inválida ao consultar o histórico de atividades.") from None
