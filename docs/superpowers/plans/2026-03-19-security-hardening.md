# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the highest-risk security gaps in auth, API boundaries, upload handling, and local/container defaults without breaking the current MVP flow.

**Architecture:** Move browser auth to server-managed cookies, keep a temporary bearer fallback on the API for compatibility, route NLP access through the API boundary, and add explicit validation/guardrails at configuration and request-entry layers. Container and dependency changes should tighten defaults while preserving local development.

**Tech Stack:** FastAPI, SQLAlchemy, Next.js, Zustand, Docker Compose, pytest, TypeScript

---

### Task 1: Plan Session/Auth Hardening

**Files:**
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/app/core/security.py`
- Modify: `apps/api/app/api/deps.py`
- Modify: `apps/api/app/api/routes/auth.py`
- Modify: `apps/api/app/schemas/auth.py`
- Modify: `packages/shared-types/src/contracts.ts`
- Modify: `docs/api-contract.md`
- Test: `apps/api/tests/test_auth_and_today_stats_routes.py`

- [ ] Write failing auth/session tests first.
- [ ] Verify they fail for cookie-based login/logout/session bootstrap expectations.
- [ ] Implement secure config validation, shorter session lifetime, cookie auth, and logout.
- [ ] Re-run focused auth tests until green.

### Task 2: Plan Upload And Abuse Protections

**Files:**
- Modify: `apps/api/app/schemas/article.py`
- Modify: `apps/api/app/services/epub_parser.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/app/services/rate_limit.py`
- Modify: `apps/api/app/api/routes/auth.py`
- Test: `apps/api/tests/test_article_epub_processing.py`
- Test: `apps/api/tests/test_auth_and_today_stats_routes.py`

- [ ] Add failing tests for oversized article payloads, oversized EPUB archives, and auth throttling.
- [ ] Verify failures are caused by missing protections, not test defects.
- [ ] Implement bounded payload parsing and auth rate limiting with a safe local fallback.
- [ ] Re-run focused tests until green.

### Task 3: Plan API/NLP Boundary Tightening

**Files:**
- Modify: `apps/api/app/api/router.py`
- Create: `apps/api/app/api/routes/nlp_proxy.py`
- Modify: `apps/api/app/services/nlp_client.py`
- Modify: `apps/api/tests/test_auth_and_today_stats_routes.py`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/api-client.ts`
- Modify: `apps/web/lib/env.ts`

- [ ] Add failing tests for API-side NLP proxy routes.
- [ ] Implement API proxy routes and keep browser traffic on the API host.
- [ ] Remove direct frontend NLP base usage.
- [ ] Re-run focused backend tests plus frontend type/build checks.

### Task 4: Plan Frontend Session Refactor

**Files:**
- Modify: `apps/web/lib/auth-store.ts`
- Modify: `apps/web/lib/use-require-auth.ts`
- Modify: `apps/web/components/providers.tsx`
- Modify: `apps/web/components/top-nav.tsx`
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] Update the auth store so it no longer persists tokens to local storage.
- [ ] Bootstrap session state from `/auth/me`.
- [ ] Switch login/logout UX to cookie-backed session flows.
- [ ] Re-run TypeScript/build verification.

### Task 5: Plan Container And Dependency Hardening

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `apps/api/.env.example`
- Modify: `apps/web/.env.example`
- Modify: `infra/docker/api.Dockerfile`
- Modify: `infra/docker/nlp.Dockerfile`
- Modify: `infra/docker/web.Dockerfile`
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `apps/api/requirements.lock.txt`
- Create: `services/nlp/requirements.lock.txt`

- [ ] Pin the audited Next.js fix version and adopt `npm ci` in Docker.
- [ ] Create exact-version Python lock-style requirement files from the current environments.
- [ ] Tighten compose port exposure and example env defaults.
- [ ] Re-run dependency-aware verification commands.
