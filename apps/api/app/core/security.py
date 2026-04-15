from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import bcrypt
from fastapi import Response
from jose import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# passlib 1.7 still reads bcrypt.__about__.__version__, which bcrypt 4 removed.
if not hasattr(bcrypt, "__about__") and getattr(bcrypt, "__version__", None):
    bcrypt.__about__ = SimpleNamespace(__version__=bcrypt.__version__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def normalize_email(value: str) -> str:
    return value.strip().lower()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    ttl_minutes = expires_minutes if expires_minutes is not None else settings.jwt_expire_minutes
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    payload = {"sub": subject, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_access_token_max_age_seconds() -> int:
    settings = get_settings()
    return settings.jwt_expire_minutes * 60


def set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    max_age = get_access_token_max_age_seconds()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=max_age,
        expires=max_age,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.auth_cookie_name,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/",
    )
