# Third-party attribution — Flow reader shell (design reference)

## Summary

Genbun's reader is being reshaped into a "professional reading workbench" shell
(left activity bar, toggleable side panels, centered reading column, mobile bottom
toolbar). The **interaction design / shell layout ideas** for this work are inspired
by the open-source EPUB reader **Flow**.

This document records that attribution and the compliance boundary, because Flow is
licensed under **AGPL-3.0**.

## Reference project

- Project: **Flow** by pacexy
- Repository: https://github.com/pacexy/flow
- License: **GNU Affero General Public License v3.0 (AGPL-3.0)**

## What was borrowed

We borrowed **interaction / UX ideas and shell structure**, specifically:

- A narrow left **activity bar** that switches between side panels.
- A toggleable **side panel** region (search / highlights / typography / theme).
- A **typography** panel (font size, line height, content width / "measure").
- A **theme** panel (a small, fixed set of reading themes).
- An in-document **search** panel that jumps to matches.
- A **highlights / favorites** panel listing saved passages.
- A **mobile bottom toolbar** mirroring the activity bar.

## What was NOT done — no direct source copied

- **No direct source copied.** No source files, code snippets, component code,
  CSS, or assets were copied from the Flow repository into Genbun.
- At the time of this work the Flow source could not be (and was not) fetched in the
  build environment. The shell here is a **clean-room, lightweight, hand-written
  re-implementation** of the equivalent interaction ideas, written specifically for
  Genbun's existing React / Next.js / Tailwind / React Query stack.
- All of Genbun's **backend, API contracts, database schema, business logic**
  (auth, articles, tokenization/lookup, highlights, AI sentence breakdown, vocab,
  spaced-repetition review, analytics) remain **Genbun's own implementation** and are
  unrelated to Flow.

## Compliance notes

- Because only **ideas / interaction patterns** were used (ideas are not copyrightable)
  and **no Flow source was copied**, this work does not incorporate Flow's AGPL-licensed
  code into Genbun.
- This file exists to make the design lineage explicit and to avoid any confusion about
  provenance. If, in the future, any actual Flow source code is ported into Genbun, the
  AGPL-3.0 obligations (including source availability) must be reviewed and satisfied
  before doing so, and this document must be updated accordingly.

_Last updated: 2026-05-29._
