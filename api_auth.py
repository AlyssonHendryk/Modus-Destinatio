"""Supabase authentication and authorization using active database profiles."""

import os
from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthSettings:
    issuer: str
    audience: str
    algorithm: str
    secret: str | None = None

    @classmethod
    def from_environment(cls):
        url = os.getenv("SUPABASE_URL", "").rstrip("/")
        algorithm = os.getenv("SUPABASE_JWT_ALGORITHM", "")
        audience = os.getenv("SUPABASE_JWT_AUDIENCE", "")
        issuer = os.getenv("SUPABASE_JWT_ISSUER") or (url + "/auth/v1" if url else "")
        secret = os.getenv("SUPABASE_JWT_SECRET")
        if not issuer or not audience or algorithm not in {"ES256", "RS256", "HS256"}:
            raise HTTPException(503, "Configuração de validação JWT incompleta.")
        if algorithm == "HS256" and not secret:
            raise HTTPException(503, "Segredo de assinatura JWT não configurado no backend.")
        return cls(issuer, audience, algorithm, secret)


@lru_cache(maxsize=8)
def jwks_client(issuer):
    # The issuer comes from trusted server configuration, never from the token.
    return jwt.PyJWKClient(issuer.rstrip("/") + "/.well-known/jwks.json", timeout=5)


def verify_token(token, settings):
    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") != settings.algorithm:
            raise jwt.InvalidAlgorithmError()
        if settings.algorithm == "HS256":
            key = settings.secret
        else:
            key = jwks_client(settings.issuer).get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=[settings.algorithm],
            issuer=settings.issuer,
            audience=settings.audience,
            options={"require": ["exp", "iss", "aud", "sub"], "verify_signature": True},
        )
        UUID(claims["sub"])
        return claims
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(503, "Serviço de validação de sessão indisponível.") from None
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise HTTPException(
            401, "Sessão inválida ou expirada.", headers={"WWW-Authenticate": "Bearer"}
        ) from None


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    role: str


def require_active_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
):
    if credentials is None:
        raise HTTPException(
            401, "Autenticação necessária.", headers={"WWW-Authenticate": "Bearer"}
        )
    claims = verify_token(credentials.credentials, AuthSettings.from_environment())
    try:
        response = (
            request.app.state.profile_client.schema("public")
            .table("profiles")
            .select("id, role, status")
            .eq("id", claims["sub"])
            .limit(2)
            .execute()
        )
    except Exception:
        raise HTTPException(503, "Não foi possível verificar o perfil.") from None
    rows = response.data
    if not isinstance(rows, list) or len(rows) != 1:
        raise HTTPException(403, "Perfil não autorizado.")
    profile = rows[0]
    if (
        profile.get("id") != claims["sub"]
        or profile.get("status") != "active"
        or profile.get("role") not in {"admin", "employee"}
    ):
        raise HTTPException(403, "Perfil não autorizado.")
    user = AuthenticatedUser(id=claims["sub"], role=profile["role"])
    request.state.authenticated_user = user
    return user


def require_admin(user: AuthenticatedUser = Depends(require_active_user)):
    """Require an active administrator; never use a frontend or JWT role."""
    if user.role != "admin":
        raise HTTPException(403, "Esta operação exige um administrador.")
    return user
