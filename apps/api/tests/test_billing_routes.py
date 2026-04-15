from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_db_session
from app.core.config import get_settings

get_settings.cache_clear()
from app.main import app  # noqa: E402
from app.models.entities import User  # noqa: E402


@pytest.fixture()
def client_with_billing_db(tmp_path):
    db_path = tmp_path / "billing_routes_test.db"
    engine = create_engine(f"sqlite+pysqlite:///{db_path}")
    User.__table__.create(bind=engine, checkfirst=True)

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


def test_create_checkout_session_returns_checkout_url(
    client_with_billing_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = client_with_billing_db
    payload = {
        "email": f"checkout-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }
    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201

    monkeypatch.setattr(
        "app.api.routes.billing.create_stripe_checkout_session",
        lambda **kwargs: {
            "id": "cs_test_123",
            "url": "https://checkout.stripe.test/session/cs_test_123",
        },
    )

    response = client.post("/billing/checkout-session")

    assert response.status_code == 200
    assert response.json() == {
        "checkout_url": "https://checkout.stripe.test/session/cs_test_123",
    }


def test_billing_webhook_upgrades_user_to_pro(
    client_with_billing_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = client_with_billing_db
    payload = {
        "email": f"upgrade-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }
    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201
    user_id = register_response.json()["user"]["id"]

    event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test_123",
                "customer": "cus_test_123",
                "status": "active",
                "metadata": {
                    "user_id": user_id,
                    "plan": "pro",
                },
            }
        },
    }

    monkeypatch.setattr(
        "app.api.routes.billing.construct_stripe_event",
        lambda payload, signature_header: event,
    )

    response = client.post(
        "/billing/webhook",
        content=b'{"fake":"event"}',
        headers={"stripe-signature": "t=123,v1=test"},
    )

    assert response.status_code == 200
    assert response.json() == {"received": True}

    with client.session_local() as db:  # type: ignore[attr-defined]
        user = db.scalar(select(User).where(User.id == uuid.UUID(user_id)))
        assert user is not None
        assert user.plan == "pro"
        assert user.stripe_customer_id == "cus_test_123"
        assert user.stripe_subscription_id == "sub_test_123"
        assert user.billing_status == "active"


def test_billing_webhook_downgrades_user_to_free(
    client_with_billing_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = client_with_billing_db
    payload = {
        "email": f"downgrade-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }
    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201
    user_id = uuid.UUID(register_response.json()["user"]["id"])

    with client.session_local() as db:  # type: ignore[attr-defined]
        user = db.scalar(select(User).where(User.id == user_id))
        assert user is not None
        user.plan = "pro"
        user.stripe_customer_id = "cus_test_123"
        user.stripe_subscription_id = "sub_test_123"
        user.billing_status = "active"
        db.commit()

    event = {
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_test_123",
                "customer": "cus_test_123",
                "status": "canceled",
                "metadata": {
                    "user_id": str(user_id),
                    "plan": "pro",
                },
            }
        },
    }

    monkeypatch.setattr(
        "app.api.routes.billing.construct_stripe_event",
        lambda payload, signature_header: event,
    )

    response = client.post(
        "/billing/webhook",
        content=b'{"fake":"event"}',
        headers={"stripe-signature": "t=123,v1=test"},
    )

    assert response.status_code == 200
    assert response.json() == {"received": True}

    with client.session_local() as db:  # type: ignore[attr-defined]
        user = db.scalar(select(User).where(User.id == user_id))
        assert user is not None
        assert user.plan == "free"
        assert user.stripe_customer_id == "cus_test_123"
        assert user.stripe_subscription_id is None
        assert user.billing_status == "canceled"


def test_create_billing_portal_session_returns_portal_url(
    client_with_billing_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = client_with_billing_db
    payload = {
        "email": f"portal-{uuid.uuid4().hex[:12]}@example.com",
        "password": "strong-password-123",
    }
    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201
    user_id = uuid.UUID(register_response.json()["user"]["id"])

    with client.session_local() as db:  # type: ignore[attr-defined]
        user = db.scalar(select(User).where(User.id == user_id))
        assert user is not None
        user.plan = "pro"
        user.stripe_customer_id = "cus_test_123"
        user.billing_status = "active"
        db.commit()

    monkeypatch.setattr(
        "app.api.routes.billing.create_stripe_billing_portal_session",
        lambda **kwargs: {
            "url": "https://billing.stripe.test/session/bps_test_123",
        },
    )

    response = client.post("/billing/portal-session")

    assert response.status_code == 200
    assert response.json() == {
        "portal_url": "https://billing.stripe.test/session/bps_test_123",
    }
