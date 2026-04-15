# Billing Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal commercialization foundation by exposing user plan state and enforcing monthly AI explanation quotas without introducing a full payment system yet.

**Architecture:** Extend the existing user model with a simple plan field, derive monthly AI usage from product events, expose a `GET /billing/me` endpoint, and gate AI explanation creation by plan quota. Surface the result in the web settings/pricing UI so future payment integration has a stable contract to target.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Next.js App Router, TypeScript, pytest

---

### Task 1: Lock Billing Behavior With Tests

**Files:**
- Modify: `apps/api/tests/test_auth_and_today_stats_routes.py`

- [ ] Add a failing test for `GET /billing/me` returning a default free plan summary.
- [ ] Add a failing test for rejecting AI explanations when the monthly plan quota is exhausted.
- [ ] Run the focused backend tests and verify they fail for missing billing behavior.

### Task 2: Add Backend Billing Foundation

**Files:**
- Modify: `apps/api/app/models/entities.py`
- Modify: `apps/api/app/core/config.py`
- Create: `apps/api/app/services/billing.py`
- Create: `apps/api/app/api/routes/billing.py`
- Modify: `apps/api/app/api/router.py`
- Modify: `apps/api/app/api/routes/ai_explanations.py`
- Modify: `apps/api/app/schemas/auth.py`
- Create: `apps/api/app/schemas/billing.py`

- [ ] Add a simple user plan field with `free|pro`.
- [ ] Add billing summary schema and route.
- [ ] Derive current-month AI usage from product events and enforce plan quota in the AI explanation route.
- [ ] Re-run focused backend tests until green.

### Task 3: Mirror Billing Contract To Web

**Files:**
- Modify: `packages/shared-types/src/contracts.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/app/pricing/page.tsx`

- [ ] Add shared billing types and API client.
- [ ] Show current plan/usage in Settings.
- [ ] Update Pricing to reflect the actual free/pro quota contract.

### Task 4: Verification

**Files:**
- Verify: `apps/api/tests/test_auth_and_today_stats_routes.py`
- Verify: `apps/web/**/*`

- [ ] Run `pytest -q apps/api/tests/test_auth_and_today_stats_routes.py`.
- [ ] Run `npm run typecheck:web`.
- [ ] Review the final diff for accidental scope creep before reporting status.
