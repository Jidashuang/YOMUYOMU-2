from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.core.config import get_settings
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.models.entities import User
from app.schemas.auth import AuthLoginRequest, AuthRegisterRequest, AuthTokenResponse, AuthUser, UserProfile

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: AuthRegisterRequest, request: Request, db: Session = Depends(get_db_session)
) -> AuthTokenResponse:
    enforce_rate_limit(
        f"register:ip:{client_ip(request)}",
        limit=get_settings().register_per_hour_limit,
        window_seconds=3600,
        message="注册太频繁了，请一小时后再试。",
    )
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return AuthTokenResponse(access_token=token, user=AuthUser(id=user.id, email=user.email))


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: AuthLoginRequest, request: Request, db: Session = Depends(get_db_session)) -> AuthTokenResponse:
    # 按 IP 和按邮箱各限一次：既防一台机器猜很多账号，也防很多机器猜同一个账号
    limit = get_settings().login_per_15min_limit
    message = "登录尝试太多了，请 15 分钟后再试。"
    enforce_rate_limit(f"login:ip:{client_ip(request)}", limit=limit, window_seconds=900, message=message)
    enforce_rate_limit(f"login:email:{payload.email.lower()}", limit=limit, window_seconds=900, message=message)
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return AuthTokenResponse(access_token=token, user=AuthUser(id=user.id, email=user.email))


@router.get("/me", response_model=UserProfile)
def me(current_user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile(id=current_user.id, email=current_user.email, created_at=current_user.created_at)
