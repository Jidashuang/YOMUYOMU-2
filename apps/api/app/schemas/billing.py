from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class AIExplanationQuotaSummary(BaseModel):
    used_this_month: int
    monthly_limit: int
    remaining: int


class BillingSummaryResponse(BaseModel):
    plan: Literal["free", "pro"]
    billing_status: str | None = None
    ai_explanations: AIExplanationQuotaSummary


class BillingCheckoutSessionResponse(BaseModel):
    checkout_url: str


class BillingPortalSessionResponse(BaseModel):
    portal_url: str


class BillingWebhookResponse(BaseModel):
    received: bool
