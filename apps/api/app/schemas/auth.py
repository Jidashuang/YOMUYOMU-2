from __future__ import annotations

from typing import Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.security import normalize_email

COMMON_WEAK_PASSWORDS = {
    "123456789",
    "12345678",
    "abcdefgh",
    "password",
    "password123",
    "qwerty123",
}


class AuthRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email_value(cls, value: str) -> str:
        return normalize_email(str(value))

    @model_validator(mode="after")
    def validate_password(self) -> "AuthRegisterRequest":
        if self.password.isspace():
            raise ValueError("Password must not be all whitespace")
        if self.password.lower() == self.email:
            raise ValueError("Password must not equal email")
        if self.password.lower() in COMMON_WEAK_PASSWORDS:
            raise ValueError("Password is too weak")
        return self


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email_value(cls, value: str) -> str:
        return normalize_email(str(value))


class AuthUser(BaseModel):
    id: UUID
    email: EmailStr


class AuthErrorResponse(BaseModel):
    detail: str
    code: str | None = None


class ValidationErrorDetail(BaseModel):
    type: str
    loc: list[str | int]
    msg: str
    input: Any | None = None


class ValidationErrorResponse(BaseModel):
    detail: list[ValidationErrorDetail]


class AuthSessionResponse(BaseModel):
    user: AuthUser


class UserProfile(BaseModel):
    id: UUID
    email: EmailStr
    created_at: datetime
