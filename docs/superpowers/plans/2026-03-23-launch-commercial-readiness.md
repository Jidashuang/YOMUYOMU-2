# Launch Commercial Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-urgency public-site gaps so Yomuyomu can be shared publicly with a coherent product story, basic pricing context, and minimum legal surface.

**Architecture:** Keep the existing app routes and auth flow intact, but convert the root route into a public marketing homepage, add static pricing/privacy/terms pages, and wire navigation/footer links so logged-out users can understand the product and convert into signup.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Playwright

---

### Task 1: Lock Public-Site Requirements With E2E

**Files:**
- Create: `apps/web/e2e/public-pages.spec.ts`

- [ ] Add failing Playwright assertions for the public homepage, pricing page, and legal pages.
- [ ] Verify the spec fails because the pages and navigation are not present yet.

### Task 2: Build Marketing Homepage And Navigation

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/top-nav.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] Replace the current internal MVP root page with a public-facing homepage that explains the product and links to signup/app.
- [ ] Update navigation so logged-out users see public-site links and logged-in users still reach the app quickly.
- [ ] Add a lightweight global footer with legal links.

### Task 3: Add Pricing And Legal Pages

**Files:**
- Create: `apps/web/app/pricing/page.tsx`
- Create: `apps/web/app/privacy/page.tsx`
- Create: `apps/web/app/terms/page.tsx`

- [ ] Add a pricing page that explains the current monetization posture and routes users to signup.
- [ ] Add minimal privacy and terms pages suitable for public launch prep.

### Task 4: Verification

**Files:**
- Verify: `apps/web/e2e/public-pages.spec.ts`
- Verify: `apps/web/**/*`

- [ ] Run `npx playwright test apps/web/e2e/public-pages.spec.ts`.
- [ ] Run `npm run typecheck:web`.
- [ ] Review the final diff for accidental scope creep before reporting status.
