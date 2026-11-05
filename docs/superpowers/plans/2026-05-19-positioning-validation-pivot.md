# Yomuyomu Positioning Validation Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition Yomuyomu from a broad Japanese reader into a focused validation MVP for Chinese-speaking N4-N2 learners reading real Japanese content.

**Architecture:** Keep the existing reader, import, AI explanation, vocab, billing, and auth foundations. Change the public story, logged-in first-run flow, and measurement surface so the product can test whether a narrow ICP will repeatedly read, save vocab, review, and pay. Avoid new platform work until the wedge is proven.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, TanStack Query, FastAPI, PostgreSQL, Playwright

---

## Product Decision

Current framework does not need a rebuild.

Change:
- Public positioning and naming risk.
- First-run/import flow copy and defaults.
- Reader sidebar emphasis around "read this passage, understand it, save useful vocab".
- Vocab page polish for daily review behavior.
- Minimal analytics needed for the 2-week validation.

Do not change yet:
- Core auth.
- Stripe billing foundation.
- NLP service architecture.
- AI explanation storage model.
- Article/import data model.
- Full mobile native app.
- Large content library.
- Social, gamification, or multi-language features.

## Validation Target

ICP:
- Chinese-native Japanese learner.
- N4-N2 level.
- Already reads real Japanese content at least weekly.
- Currently uses a tool chain such as Yomitan/10ten, Anki, ChatGPT, Jisho, NHK Easy, EPUB, or browser translation.

Pass criteria after 2 weeks:
- 10 target users complete one real reading session with their own material.
- 5 users return within 3 days to read a second item.
- 5 users save vocab and complete at least one review action.
- 3 users pay or agree to pay an early Pro price.
- 6 users say Yomuyomu replaced at least one tool in their current workflow.

---

### Task 1: Lock The New Positioning In Public Pages

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/pricing/page.tsx`
- Modify: `apps/web/components/top-nav.tsx`
- Modify: `apps/web/e2e/public-pages.spec.ts`

- [ ] Change homepage headline from broad "read original text" positioning to Chinese-native N4-N2 original-reading positioning.
- [ ] Make the first viewport answer: who it is for, what content they bring, what pain it removes.
- [ ] Reduce broad SaaS language. Do not claim to be a generic Japanese reader.
- [ ] Add a lightweight naming-risk note only if the product name is still Yomuyomu during public beta.
- [ ] Update Pricing so Pro sells reading workflow outcomes, not only AI quota.
- [ ] Update public-page E2E assertions for the new headline and CTA.
- [ ] Run: `npm run test:e2e -- public-pages.spec.ts`
- [ ] Run: `npm run typecheck:web`

Expected result:
- A target user can tell within 5 seconds that this is for Chinese-speaking intermediate learners reading real Japanese.

### Task 2: Make Import Flow A Concierge-Friendly Validation Entry

**Files:**
- Modify: `apps/web/app/library/page.tsx`
- Modify: `apps/web/e2e/library-import.spec.ts`

- [ ] Replace the generic sample title/content with a target-user sample passage.
- [ ] Add concise copy asking the user to paste a passage they recently failed to read smoothly.
- [ ] Keep only text and EPUB import. Do not add URL import or OCR yet.
- [ ] Make the empty library state push one clear action: paste a real passage.
- [ ] Add or update E2E coverage for the new import CTA and successful create flow.
- [ ] Run: `npm run test:e2e -- library-import.spec.ts`
- [ ] Run: `npm run typecheck:web`

Expected result:
- First-time users understand that Yomuyomu wants their real reading material, not demo content.

### Task 3: Tighten Reader Around One Core Job

**Files:**
- Modify: `apps/web/app/reader/[id]/page.tsx`
- Modify: `apps/web/app/reader/[id]/components/ExplanationPanel.tsx`
- Modify: `apps/web/app/reader/[id]/components/TokenPopup.tsx`
- Modify: `apps/web/e2e/reader-smoke.spec.ts`

- [ ] Change reader copy from product explanation to task language: read, ask AI about a sentence, save useful vocab.
- [ ] Keep lookup, highlight, AI explanation, and add-to-vocab behavior intact.
- [ ] In the AI panel, prioritize Chinese explanation, grammar breakdown, and suggested vocab.
- [ ] In token popup, make add-to-vocab the obvious next action after lookup.
- [ ] Do not add new AI modes, chat, tutor flow, or grammar-course features.
- [ ] Update reader smoke test for the core reading-to-vocab path.
- [ ] Run: `npm run test:e2e -- reader-smoke.spec.ts`
- [ ] Run: `npm run typecheck:web`

Expected result:
- The reader feels like a focused original-text study workflow, not a generic article viewer.

### Task 4: Polish Vocab As The Proof Of Retention

**Files:**
- Modify: `apps/web/app/vocab/page.tsx`
- Modify: `apps/web/e2e/reader-smoke.spec.ts` or create focused vocab E2E coverage if needed

- [ ] Rename visible buckets into learner-friendly Chinese labels while preserving API buckets.
- [ ] Make "到期复习" the primary section.
- [ ] Keep CSV/JSON export, but do not build Anki export unless validation interviews show repeated demand.
- [ ] Remove developer-facing labels from card copy where they hurt user trust, such as raw `review_count` style text.
- [ ] Verify status changes and review pass/fail still work.
- [ ] Run the focused E2E covering vocab add/review behavior.
- [ ] Run: `npm run typecheck:web`

Expected result:
- Review behavior becomes visible enough to test whether users actually come back.

### Task 5: Add Minimal Validation Analytics

**Files:**
- Inspect first: `apps/api/app/models/entities.py`
- Inspect first: `apps/api/app/api/routes/analytics.py`
- Inspect first: `apps/api/app/services/billing.py`
- Modify only if existing product events are insufficient.
- Potentially modify: `apps/api/app/api/routes/reader_data.py`
- Potentially modify: `apps/api/app/api/routes/articles.py`
- Potentially modify: `packages/shared-types/src/contracts.ts`
- Potentially modify: `apps/web/app/settings/page.tsx`

- [ ] Confirm whether existing event types already capture article import, lookup, AI explanation, vocab add, and review.
- [ ] If review events are missing, add the smallest event emission at the existing review endpoint.
- [ ] Avoid a new analytics dashboard unless the data is already available.
- [ ] Add one simple validation summary only if it helps the founder run the 2-week test.
- [ ] Add focused backend tests for any new event emission.
- [ ] Run focused API tests for touched routes.
- [ ] Run: `npm run typecheck:web` if shared types or web UI changed.

Expected result:
- The team can answer: who imported, who used AI, who saved vocab, who reviewed, who came back.

### Task 6: Prepare The Manual First-10 Workflow

**Files:**
- Create: `docs/validation/first-10-customers.md`

- [ ] Write the exact ICP filter.
- [ ] Write the outreach message in Chinese and English.
- [ ] Define what to record during each session.
- [ ] Define pass/fail criteria using behavioral signals, not compliments.
- [ ] Keep it as an internal operating doc. Do not add product features for this.

Expected result:
- The founder can run 10 concierge sessions without inventing the process each time.

---

## Suggested Execution Order

1. Task 1: Positioning.
2. Task 2: Import entry.
3. Task 3: Reader core job.
4. Task 4: Vocab retention proof.
5. Task 5: Analytics only if needed.
6. Task 6: Manual validation doc.

Stop after Task 2 if users still cannot understand the product. Do not continue polishing internals before the positioning and import story are clear.

## Open Decisions

- Rename now or later: recommended to decide before any public launch because `Yomuyomu` has brand collision risk.
- ICP language: recommended to start with Chinese-native learners, not global learners.
- Content wedge: choose one first outreach batch, such as light novels, NHK/news, JLPT reading, or general web articles.
- Anki export: keep as a likely near-term bridge, but add only after users explicitly ask during validation.

## Verification Notes

- Avoid Xcode builds for this work.
- Prefer focused Playwright specs and typecheck.
- Do not add broad features while validating positioning.
- If the implementation touches API behavior, run the smallest focused pytest target.
