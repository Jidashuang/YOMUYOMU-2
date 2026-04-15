from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session, get_request_ip
from app.core.config import get_settings
from app.core.security import (
    clear_session_cookie,
    create_access_token,
    hash_password,
    normalize_email,
    set_session_cookie,
    verify_password,
)
from app.models.entities import User
from app.schemas.auth import (
    AuthErrorResponse,
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthSessionResponse,
    AuthUser,
    UserProfile,
    ValidationErrorResponse,
)
from app.services.rate_limit import clear_rate_limit, is_rate_limited

router = APIRouter(prefix="/auth", tags=["auth"])

REGISTER_RESPONSES = {
    status.HTTP_409_CONFLICT: {"model": AuthErrorResponse, "description": "Email already registered"},
    status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": ValidationErrorResponse, "description": "Request validation failed"},
    status.HTTP_429_TOO_MANY_REQUESTS: {"model": AuthErrorResponse, "description": "Authentication rate limit exceeded"},
}

LOGIN_RESPONSES = {
    status.HTTP_401_UNAUTHORIZED: {"model": AuthErrorResponse, "description": "Invalid credentials"},
    status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": ValidationErrorResponse, "description": "Request validation failed"},
    status.HTTP_429_TOO_MANY_REQUESTS: {"model": AuthErrorResponse, "description": "Authentication rate limit exceeded"},
}

AUTH_REQUIRED_RESPONSES = {
    status.HTTP_401_UNAUTHORIZED: {"model": AuthErrorResponse, "description": "Authentication required"},
}


def _error_response(
    status_code: int,
    detail: str,
    code: str,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail, "code": code},
        headers=headers,
    )


def _auth_rate_limit_response() -> JSONResponse:
    return _error_response(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many authentication attempts. Try again later.",
        code="rate_limited",
    )


def _enforce_auth_rate_limit(request: Request, normalized_email: str, action: str) -> JSONResponse | None:
    settings = get_settings()
    request_ip = get_request_ip(request)
    if is_rate_limited(
        "auth-ip",
        f"{action}:{request_ip}",
        settings.auth_rate_limit_max_attempts_per_ip,
        settings.auth_rate_limit_window_seconds,
    ):
        return _auth_rate_limit_response()
    if is_rate_limited(
        "auth-identity",
        f"{action}:{normalized_email}",
        settings.auth_rate_limit_max_attempts_per_identity,
        settings.auth_rate_limit_window_seconds,
    ):
        return _auth_rate_limit_response()
    return None


def _clear_auth_rate_limit(request: Request, normalized_email: str, action: str) -> None:
    request_ip = get_request_ip(request)
    clear_rate_limit("auth-ip", f"{action}:{request_ip}")
    clear_rate_limit("auth-identity", f"{action}:{normalized_email}")


@router.post(
    "/register",
    response_model=AuthSessionResponse,
    status_code=status.HTTP_201_CREATED,
    responses=REGISTER_RESPONSES,
)
def register(
    payload: AuthRegisterRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db_session),
) -> AuthSessionResponse | JSONResponse:
    normalized_email = normalize_email(payload.email)
    if rate_limited := _enforce_auth_rate_limit(request, normalized_email, "register"):
        return rate_limited

    existing = db.scalar(select(User).where(User.email == normalized_email))
    if existing:
        return _error_response(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
            code="email_already_registered",
        )

    user = User(email=normalized_email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.scalar(select(User).where(User.email == normalized_email)):
            return _error_response(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
                code="email_already_registered",
            )
        raise
    db.refresh(user)

    token = create_access_token(str(user.id))
    set_session_cookie(response, token)
    _clear_auth_rate_limit(request, normalized_email, "register")
    return AuthSessionResponse(user=AuthUser(id=user.id, email=user.email))


@router.post("/login", response_model=AuthSessionResponse, responses=LOGIN_RESPONSES)
def login(
    payload: AuthLoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db_session),
) -> AuthSessionResponse | JSONResponse:
    normalized_email = normalize_email(payload.email)
    if rate_limited := _enforce_auth_rate_limit(request, normalized_email, "login"):
        return rate_limited

    user = db.scalar(select(User).where(User.email == normalized_email))
    if not user or not verify_password(payload.password, user.password_hash):
        return _error_response(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            code="invalid_credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(str(user.id))
    set_session_cookie(response, token)
    _clear_auth_rate_limit(request, normalized_email, "login")
    return AuthSessionResponse(user=AuthUser(id=user.id, email=user.email))


@router.get("/me", response_model=UserProfile, responses=AUTH_REQUIRED_RESPONSES)
def me(current_user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile(id=current_user.id, email=current_user.email, created_at=current_user.created_at)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
