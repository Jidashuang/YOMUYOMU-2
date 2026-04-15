from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_db_session
from app.core.config import get_settings
from app.core.security import hash_password

get_settings.cache_clear()
from app.main import app  # noqa: E402
from app.models.entities import Article, ProductEvent, User  # noqa: E402


@pytest.fixture()
def client_with_test_db(tmp_path):
    db_path = tmp_path / "api_routes_test.db"
    engine = create_engine(f"sqlite+pysqlite:///{db_path}")
    Article.__table__.create(bind=engine, checkfirst=True)
    User.__table__.create(bind=engine, checkfirst=True)
    ProductEvent.__table__.create(bind=engine, checkfirst=True)

    session_local = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)

    def _override_get_db_session():
        db = session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db_session] = _override_get_db_session
    try:
        with TestClient(app, base_url="https://testserver") as client:
            client.session_local = session_local  # type: ignore[attr-defined]
            yield client
    finally:
        app.dependency_overrides.pop(get_db_session, None)


def test_register_then_login_roundtrip(client_with_test_db) -> None:
    client = client_with_test_db
    payload = {
        "email": f"auth-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }

    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201
    assert register_response.json() == {
        "user": {
            "id": register_response.json()["user"]["id"],
            "email": payload["email"],
        }
    }
    assert "access_token" not in register_response.json()
    assert "yomuyomu_session=" in register_response.headers.get("set-cookie", "")

    me_response = client.get("/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == payload["email"]

    login_response = client.post("/auth/login", json=payload)
    assert login_response.status_code == 200
    assert login_response.json()["user"]["email"] == payload["email"]
    assert "access_token" not in login_response.json()
    assert "yomuyomu_session=" in login_response.headers.get("set-cookie", "")


def test_register_normalizes_email_and_duplicate_returns_code(client_with_test_db) -> None:
    client = client_with_test_db

    first_response = client.post(
        "/auth/register",
        json={
            "email": "  MixedCaseUser@example.com  ",
            "password": "strong-password-123",
        },
    )
    assert first_response.status_code == 201
    assert first_response.json()["user"]["email"] == "mixedcaseuser@example.com"

    second_response = client.post(
        "/auth/register",
        json={
            "email": "mixedcaseuser@example.com",
            "password": "strong-password-123",
        },
    )
    assert second_response.status_code == 409
    assert second_response.json() == {
        "detail": "Email already registered",
        "code": "email_already_registered",
    }


def test_register_rejects_password_equal_email(client_with_test_db) -> None:
    client = client_with_test_db

    response = client.post(
        "/auth/register",
        json={
            "email": "same@example.com",
            "password": "same@example.com",
        },
    )
    assert response.status_code == 422
    assert "Password must not equal email" in response.text


def test_register_rejects_password_whitespace_only(client_with_test_db) -> None:
    client = client_with_test_db

    response = client.post(
        "/auth/register",
        json={
            "email": "whitespace@example.com",
            "password": "        ",
        },
    )

    assert response.status_code == 422
    assert "Password must not be all whitespace" in response.text


def test_register_rejects_weak_password(client_with_test_db) -> None:
    client = client_with_test_db

    response = client.post(
        "/auth/register",
        json={
            "email": "weak@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 422
    assert "Password is too weak" in response.text


def test_login_normalizes_email_and_invalid_credentials_return_code(client_with_test_db) -> None:
    client = client_with_test_db
    payload = {
        "email": f"login-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }

    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={
            "email": f"  {payload['email'].upper()}  ",
            "password": "wrong-password-123",
        },
    )

    assert login_response.status_code == 401
    assert login_response.json() == {
        "detail": "Invalid credentials",
        "code": "invalid_credentials",
    }
    assert login_response.headers["www-authenticate"] == "Bearer"


def test_register_maps_duplicate_email_integrity_error_to_conflict(client_with_test_db, monkeypatch: pytest.MonkeyPatch) -> None:
    client = client_with_test_db
    payload = {
        "email": f"race-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }
    original_commit = Session.commit
    injected_duplicate = False
    session_local = client.session_local  # type: ignore[attr-defined]

    def commit_with_duplicate(self: Session):
        nonlocal injected_duplicate
        pending_users = [item for item in self.new if isinstance(item, User)]
        should_inject = any(user.email == payload["email"] for user in pending_users)
        if should_inject and not injected_duplicate:
            injected_duplicate = True
            other_session = session_local()
            try:
                other_session.add(User(email=payload["email"], password_hash=hash_password("other-password-123")))
                original_commit(other_session)
            finally:
                other_session.close()
        return original_commit(self)

    monkeypatch.setattr(Session, "commit", commit_with_duplicate)

    response = client.post("/auth/register", json=payload)

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Email already registered",
        "code": "email_already_registered",
    }


def test_register_reraises_non_duplicate_integrity_error(client_with_test_db, monkeypatch: pytest.MonkeyPatch) -> None:
    client = client_with_test_db
    payload = {
        "email": f"integrity-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }

    def commit_with_other_integrity_error(self: Session):
        raise IntegrityError("insert into users", {}, Exception("unexpected integrity failure"))

    monkeypatch.setattr(Session, "commit", commit_with_other_integrity_error)

    with pytest.raises(IntegrityError):
        client.post("/auth/register", json=payload)


def test_logout_clears_cookie_session(client_with_test_db) -> None:
    client = client_with_test_db
    payload = {
        "email": f"logout-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }

    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201

    me_response = client.get("/auth/me")
    assert me_response.status_code == 200

    logout_response = client.post("/auth/logout")
    assert logout_response.status_code == 204
    assert "Max-Age=0" in logout_response.headers.get("set-cookie", "")

    me_after_logout = client.get("/auth/me")
    assert me_after_logout.status_code == 401


def test_login_rate_limit_returns_429(client_with_test_db) -> None:
    client = client_with_test_db
    email = f"ratelimit-{uuid.uuid4().hex[:12]}@example.com"
    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "correct-password-123",
        },
    )
    assert register_response.status_code == 201

    statuses = []
    for _ in range(6):
        response = client.post(
            "/auth/login",
            json={
                "email": email,
                "password": "wrong-password-123",
            },
        )
        statuses.append(response.status_code)

    assert statuses[-1] == 429


def test_create_article_rejects_oversized_payload(client_with_test_db) -> None:
    client = client_with_test_db
    payload = {
        "email": f"article-limit-{uuid.uuid4().hex[:12]}@example.com",
        "password": "correct-password-123",
    }
    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201

    article_response = client.post(
        "/articles",
        json={
            "title": "too big",
            "source_type": "text",
            "raw_content": "x" * 400_000,
        },
    )
    assert article_response.status_code == 413


def test_today_stats_returns_zero_for_new_user(client_with_test_db) -> None:
    client = client_with_test_db
    payload = {
        "email": f"stats-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }

    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201

    today_response = client.get("/analytics/today")
    assert today_response.status_code == 200
    data = today_response.json()
    assert isinstance(data["date"], str)
    assert data["lookup_count"] == 0
    assert data["vocab_added_count"] == 0
    assert data["ai_explanation_count"] == 0


def test_billing_me_returns_default_free_plan_summary(client_with_test_db) -> None:
    client = client_with_test_db
    payload = {
        "email": f"billing-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }

    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201

    billing_response = client.get("/billing/me")
    assert billing_response.status_code == 200
    assert billing_response.json() == {
        "plan": "free",
        "ai_explanations": {
            "used_this_month": 0,
            "monthly_limit": 20,
            "remaining": 20,
        },
    }


def test_ai_explanations_reject_when_monthly_plan_quota_is_exhausted(client_with_test_db) -> None:
    client = client_with_test_db
    payload = {
        "email": f"quota-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }

    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201
    user_id = uuid.UUID(register_response.json()["user"]["id"])

    with client.session_local() as db:  # type: ignore[attr-defined]
        article = Article(
            user_id=user_id,
            title="quota article",
            source_type="text",
            status="ready",
            raw_content="彼は来るはずだったのに。",
            normalized_content="彼は来るはずだったのに。",
        )
        db.add(article)
        db.flush()

        for _ in range(20):
            db.add(
                ProductEvent(
                    user_id=user_id,
                    article_id=article.id,
                    event_name="ai_explanation_requested",
                    payload=None,
                )
            )

        article_id = str(article.id)
        db.commit()

    response = client.post(
        "/ai-explanations",
        json={
            "article_id": article_id,
            "sentence": "彼は来るはずだったのに。",
            "previous_sentence": "",
            "next_sentence": "",
            "user_level": "N3",
        },
    )

    assert response.status_code == 402
    assert response.json() == {
        "detail": "Monthly AI explanation limit reached for current plan",
        "code": "plan_limit_reached",
    }
