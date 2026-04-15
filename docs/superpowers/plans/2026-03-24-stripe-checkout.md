# Stripe Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimum real payment loop for Yomuyomu by creating a Stripe Checkout session, receiving Stripe webhooks, and updating the user's plan state from free to pro and back.

**Architecture:** Reuse the existing `billing` foundation and keep all payment state on the `users` row. Add a small Stripe service wrapper for Checkout creation and webhook signature verification, expose one authenticated checkout endpoint and one unauthenticated webhook endpoint, then wire the Pricing page to start the upgrade flow.

**Tech Stack:** FastAPI, SQLAlchemy, httpx, Next.js App Router, TypeScript

---

### Task 1: Lock Payment Flow With Tests

**Files:**
- Create: `apps/api/tests/test_billing_routes.py`

- [ ] Add a failing test for creating a Stripe Checkout session as an authenticated user.
- [ ] Add a failing test for a Stripe webhook upgrading a user to pro.
- [ ] Add a failing test for a Stripe webhook downgrading a user back to free.

### Task 2: Implement Stripe Billing Backend

**Files:**
- Modify: `apps/api/app/models/entities.py`
- Modify: `apps/api/app/core/config.py`
- Create: `apps/api/app/services/stripe_billing.py`
- Modify: `apps/api/app/services/billing.py`
- Modify: `apps/api/app/schemas/billing.py`
- Modify: `apps/api/app/api/routes/billing.py`
- Modify: `docs/api-contract.md`
- Create: `apps/api/alembic/versions/20260324_0009_user_billing_fields.py`

- [ ] Add customer/subscription/status fields to the user model.
- [ ] Add config for Stripe secret key, webhook secret, price id, and app base URL.
- [ ] Implement Checkout creation and webhook signature verification.
- [ ] Update billing routes to create Checkout sessions and process subscription events.

### Task 3: Add Web Upgrade Entry Point

**Files:**
- Modify: `packages/shared-types/src/contracts.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/pricing/page.tsx`

- [ ] Add shared types for Checkout session responses.
- [ ] Add a frontend call to create a Checkout session.
- [ ] Add a Pro upgrade CTA that redirects authenticated users into Stripe Checkout.

### Task 4: Verification

**Files:**
- Verify: `apps/api/tests/test_billing_routes.py`
- Verify: `apps/web/**/*`

- [ ] Run focused billing route verification.
- [ ] Confirm the Pricing page still renders after adding the upgrade CTA.
