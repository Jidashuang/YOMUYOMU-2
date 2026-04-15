# Reader UI Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the web reader into a clearer reading-first interface with stronger token affordances, cleaner AI explanations, more stable overlays, and progress/highlight flows tied back to the article.

**Architecture:** Keep the existing reader route and data flow intact, but reorganize the page into a reading-first layout. Round 1 improves structure and readability with mostly presentational changes; round 2 strengthens interaction mechanics by making overlays resilient and by tying progress/highlights to the article position.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Zustand, TanStack Query, Playwright

---

### Task 1: Round 1 Test Coverage

**Files:**
- Modify: `apps/web/e2e/reader-smoke.spec.ts`

- [ ] Add failing Playwright assertions for the round 1 reader layout and interaction affordances.
- [ ] Verify the new assertions fail for the current reader page.

### Task 2: Round 1 Reader Structure And Content Hierarchy

**Files:**
- Modify: `apps/web/app/reader/[id]/page.tsx`
- Modify: `apps/web/app/reader/[id]/components/ReaderArticleView.tsx`
- Modify: `apps/web/app/reader/[id]/components/ExplanationPanel.tsx`
- Modify: `apps/web/app/reader/[id]/components/ProgressBar.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] Rework the reader page into a reading-first two-column layout on large screens and a sensible mobile stack.
- [ ] Improve token affordances, focus styles, and selected-token feedback.
- [ ] Simplify the AI explanation panel so learning content is primary and metadata/history are secondary.
- [ ] Re-run the round 1 Playwright assertions and keep them green.

### Task 3: Round 2 Test Coverage

**Files:**
- Modify: `apps/web/e2e/reader-smoke.spec.ts`

- [ ] Add failing Playwright assertions for stable overlay behavior and article-linked progress/highlight interactions.
- [ ] Verify the new round 2 assertions fail before implementation.

### Task 4: Round 2 Overlay Stability And Reading Continuity

**Files:**
- Modify: `apps/web/app/reader/[id]/page.tsx`
- Modify: `apps/web/app/reader/[id]/components/ReaderArticleView.tsx`
- Modify: `apps/web/app/reader/[id]/components/TokenPopup.tsx`
- Modify: `apps/web/app/reader/[id]/components/HighlightMenu.tsx`
- Modify: `apps/web/app/reader/[id]/components/ProgressBar.tsx`
- Modify: `apps/web/app/reader/[id]/components/types.ts`

- [ ] Add a shared positioning strategy so token and selection overlays stay inside the viewport and close predictably.
- [ ] Link highlight cards back to article locations and expose contextual copy instead of raw block IDs.
- [ ] Drive progress from article position while preserving manual save semantics.
- [ ] Re-run the round 2 Playwright assertions and keep them green.

### Task 5: Final Verification

**Files:**
- Modify: `apps/web/e2e/reader-smoke.spec.ts`
- Verify: `apps/web/**/*`

- [ ] Run `npm run typecheck:web`.
- [ ] Run `npm run build:web`.
- [ ] Run `npm run test:e2e -- reader-smoke.spec.ts`.
- [ ] Review the final diff for accidental regressions before reporting status.
