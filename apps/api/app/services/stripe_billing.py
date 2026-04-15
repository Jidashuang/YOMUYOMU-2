from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

import httpx

from app.core.config import get_settings

STRIPE_API_BASE_URL = "https://api.stripe.com/v1"


def _get_required_stripe_settings() -> tuple[str, str]:
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise ValueError("Stripe secret key is not configured")
    if not settings.stripe_pro_price_id:
        raise ValueError("Stripe Pro price id is not configured")
    return settings.stripe_secret_key, settings.stripe_pro_price_id


def create_stripe_checkout_session(*, user_id: str, email: str, plan: str) -> dict[str, Any]:
    secret_key, pro_price_id = _get_required_stripe_settings()
    settings = get_settings()
    base_url = settings.web_base_url.rstrip("/")
    response = httpx.post(
        f"{STRIPE_API_BASE_URL}/checkout/sessions",
        headers={"Authorization": f"Bearer {secret_key}"},
        data={
            "mode": "subscription",
            "success_url": f"{base_url}/settings?upgrade=success",
            "cancel_url": f"{base_url}/pricing?upgrade=canceled",
            "customer_email": email,
            "client_reference_id": user_id,
            "line_items[0][price]": pro_price_id,
            "line_items[0][quantity]": "1",
            "metadata[user_id]": user_id,
            "metadata[plan]": plan,
            "subscription_data[metadata][user_id]": user_id,
            "subscription_data[metadata][plan]": plan,
        },
        timeout=15.0,
    )
    response.raise_for_status()
    result = response.json()
    if not isinstance(result, dict):
        raise ValueError("Stripe checkout response is invalid")
    return result


def create_stripe_billing_portal_session(*, customer_id: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise ValueError("Stripe secret key is not configured")
    response = httpx.post(
        f"{STRIPE_API_BASE_URL}/billing_portal/sessions",
        headers={"Authorization": f"Bearer {settings.stripe_secret_key}"},
        data={
            "customer": customer_id,
            "return_url": f"{settings.web_base_url.rstrip('/')}/settings",
        },
        timeout=15.0,
    )
    response.raise_for_status()
    result = response.json()
    if not isinstance(result, dict):
        raise ValueError("Stripe billing portal response is invalid")
    return result


def construct_stripe_event(payload: bytes, signature_header: str | None) -> dict[str, Any]:
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise ValueError("Stripe webhook secret is not configured")
    if not signature_header:
        raise ValueError("Missing Stripe signature")

    timestamp = ""
    signatures: list[str] = []
    for item in signature_header.split(","):
        key, _, value = item.partition("=")
        if key == "t":
            timestamp = value
        elif key == "v1":
            signatures.append(value)

    if not timestamp or not signatures:
        raise ValueError("Invalid Stripe signature header")

    signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
    expected = hmac.new(
        settings.stripe_webhook_secret.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not any(hmac.compare_digest(expected, signature) for signature in signatures):
        raise ValueError("Stripe signature verification failed")

    event = json.loads(payload.decode("utf-8"))
    if not isinstance(event, dict):
        raise ValueError("Stripe webhook payload is invalid")
    return event
