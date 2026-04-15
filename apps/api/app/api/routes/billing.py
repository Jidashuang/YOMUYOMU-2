from __future__ import annotations

from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.models.entities import User
from app.schemas.auth import AuthErrorResponse
from app.schemas.billing import (
    AIExplanationQuotaSummary,
    BillingCheckoutSessionResponse,
    BillingPortalSessionResponse,
    BillingSummaryResponse,
    BillingWebhookResponse,
)
from app.services.billing import FREE_PLAN, PRO_PLAN, get_billing_summary
from app.services.stripe_billing import (
    construct_stripe_event,
    create_stripe_billing_portal_session,
    create_stripe_checkout_session,
)

router = APIRouter(prefix="/billing", tags=["billing"])

AUTH_REQUIRED_RESPONSES = {
    status.HTTP_401_UNAUTHORIZED: {"model": AuthErrorResponse, "description": "Authentication required"},
}


@router.get("/me", response_model=BillingSummaryResponse, responses=AUTH_REQUIRED_RESPONSES)
def get_my_billing_summary(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> BillingSummaryResponse:
    summary = get_billing_summary(db, user=current_user)
    return BillingSummaryResponse(
        plan=summary.plan,
        billing_status=summary.billing_status,
        ai_explanations=AIExplanationQuotaSummary(
            used_this_month=summary.ai_explanations.used_this_month,
            monthly_limit=summary.ai_explanations.monthly_limit,
            remaining=summary.ai_explanations.remaining,
        ),
    )


@router.post(
    "/checkout-session",
    response_model=BillingCheckoutSessionResponse,
    responses=AUTH_REQUIRED_RESPONSES,
)
def create_my_checkout_session(
    current_user: User = Depends(get_current_user),
) -> BillingCheckoutSessionResponse:
    try:
        session = create_stripe_checkout_session(
            user_id=str(current_user.id),
            email=current_user.email,
            plan=PRO_PLAN,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to create Stripe checkout session") from exc

    checkout_url = session.get("url")
    if not isinstance(checkout_url, str) or not checkout_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe checkout session did not include a valid url",
        )
    return BillingCheckoutSessionResponse(checkout_url=checkout_url)


@router.post(
    "/portal-session",
    response_model=BillingPortalSessionResponse,
    responses=AUTH_REQUIRED_RESPONSES,
)
def create_my_billing_portal_session(
    current_user: User = Depends(get_current_user),
) -> BillingPortalSessionResponse:
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No active billing customer found")

    try:
        session = create_stripe_billing_portal_session(customer_id=current_user.stripe_customer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to create Stripe billing portal session") from exc

    portal_url = session.get("url")
    if not isinstance(portal_url, str) or not portal_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe billing portal session did not include a valid url",
        )
    return BillingPortalSessionResponse(portal_url=portal_url)


def _resolve_user_for_subscription_event(db: Session, subscription: dict) -> User | None:
    metadata = subscription.get("metadata") or {}
    user_id_raw = metadata.get("user_id")
    if isinstance(user_id_raw, str):
        try:
            user_id = UUID(user_id_raw)
        except ValueError:
            user_id = None
        if user_id is not None:
            user = db.get(User, user_id)
            if user is not None:
                return user

    customer_id = subscription.get("customer")
    if isinstance(customer_id, str) and customer_id:
        return db.query(User).filter(User.stripe_customer_id == customer_id).one_or_none()
    return None


def _apply_subscription_event(user: User, subscription: dict, *, event_type: str) -> None:
    customer_id = subscription.get("customer")
    subscription_id = subscription.get("id")
    billing_status = subscription.get("status")
    metadata = subscription.get("metadata") or {}
    plan = metadata.get("plan") if isinstance(metadata, dict) else None

    if isinstance(customer_id, str) and customer_id:
        user.stripe_customer_id = customer_id
    if isinstance(billing_status, str) and billing_status:
        user.billing_status = billing_status

    if event_type == "customer.subscription.deleted":
        user.plan = FREE_PLAN
        user.stripe_subscription_id = None
        return

    if isinstance(subscription_id, str) and subscription_id:
        user.stripe_subscription_id = subscription_id
    user.plan = PRO_PLAN if plan == PRO_PLAN else user.plan


@router.post("/webhook", response_model=BillingWebhookResponse)
async def handle_billing_webhook(
    request: Request,
    db: Session = Depends(get_db_session),
) -> BillingWebhookResponse:
    payload = await request.body()
    signature_header = request.headers.get("stripe-signature")
    try:
        event = construct_stripe_event(payload, signature_header)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    event_type = event.get("type")
    event_data = event.get("data") or {}
    subscription = event_data.get("object") if isinstance(event_data, dict) else None
    if not isinstance(event_type, str) or not isinstance(subscription, dict):
        return BillingWebhookResponse(received=True)

    if event_type not in {"customer.subscription.updated", "customer.subscription.deleted"}:
        return BillingWebhookResponse(received=True)

    user = _resolve_user_for_subscription_event(db, subscription)
    if user is None:
        return BillingWebhookResponse(received=True)

    _apply_subscription_event(user, subscription, event_type=event_type)
    db.add(user)
    db.commit()
    return BillingWebhookResponse(received=True)
