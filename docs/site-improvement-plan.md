# Site Improvement Plan: 日文原文阅读工作台

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前站点从旧的 `Yomuyomu / 中文母语 N4-N2` 验证 MVP，升级为面向 N2-N1 主力用户、兼容 N3 过渡用户的日文原文阅读工作台。

**Architecture:** 保留现有的文章导入、阅读器、点词查义、AI 解释、生词本、复习和认证基础。新增的核心是品牌定位、默认虚拟书架、难度标注控制和更完整的工作台式首页/阅读体验；不先重写后端架构。

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, TanStack Query, FastAPI, PostgreSQL, Playwright

---

## 1. Current State

当前代码已经有一部分能力，但没有被组织成用户一眼能懂的产品：

- `apps/web/app/page.tsx` 和 `apps/web/app/layout.tsx` 仍在使用 `Yomuyomu`、`中文母语 N4-N2` 叙事。
- `apps/web/app/library/page.tsx` 仍强调“不提供文章库”，这和新设想的默认书架冲突。
- `apps/web/app/reader/[id]/page.tsx` 已有阅读、选句 AI 解释、点词查义、生词本链路。
- `apps/web/app/reader/[id]/components/ReaderArticleView.tsx` 已按 JLPT level 给 token 上色，但没有 N3/N2/N1 难度选择器和清晰图例。
- `apps/web/app/vocab/page.tsx` 已有生词本、到期复习、今日新增、导出和状态切换。
- 设计仍是 MVP 卡片布局，页面主体偏窄、偏上，缺少“阅读工作台”的第一屏结构。

结论：这不是从零做产品，而是把已有能力重新定位、重新编排，并补一个轻量内容入口。

## 2. Product Decision

推荐定位：

> 给 N2-N1 日语学习者的原文精读工作台：从一段读不顺的日文开始，自动标出难词，点词查义，选句让 AI 中文拆解，再把值得记住的词留下来复习。

目标用户：

- Primary: 中文母语、N2-N1、正在读日文原文但仍会被长句/抽象词/文学表达卡住的人。
- Secondary: N3 后半段到 N2 过渡用户，适合通过难度过滤只显示 N3+ 或 N2+ 词。
- Exclude: N5-N4 入门用户、只想背单词的人、只想免费读小说的人、只想聊天式 AI 老师的人。

产品边界：

- 做“读完原文”的工作台，不做泛日语课程。
- 做公共领域名著的默认入口，不做版权不清的阅读库。
- 做 AI 句子拆解，不做开放式聊天老师。
- 做生词留存与复习，不先做完整 Anki 替代品。

## 3. Naming Brainstorm

推荐先选一个可验证的工作名，正式上线前再查商标/域名。

| Name | 中文感受 | 适合度 | 风险 |
| --- | --- | --- | --- |
| `Genbun / 原文` | 直接、克制、专业 | 最推荐。准确表达“读日文原文” | 英文域名可能难拿，需要组合域名 |
| `句読 / Kudoku` | 有阅读感，也有“句读”的语言细节 | 很适合阅读工具 | 日文/中文读音需要解释 |
| `読解工房 / Dokkai Kobo` | 像一个精读工作室 | 可信、偏学习工具 | 名字略长 |
| `文脈 / Bunmyaku` | 强调上下文理解 | 适合 AI 解释卖点 | 对初见用户不如“原文”直观 |
| `原文舎` | 文学、书房感 | 适合虚拟书架方向 | 有点传统，SaaS 感弱 |

建议：

- 短期产品名用 `Genbun`，中文副标题用 `日文原文阅读工作台`。
- 导航 logo 可显示 `Genbun`，首页主标题写 `日文原文精读工作台`。
- 立刻移除外部页面里的 `有木有木` 和 `Yomuyomu` 主品牌表达；代码包名和内部部署名可暂时不动。

## 4. Target Experience

首屏不要再是营销卡片，而是直接进入工作台。

登录前：

- 左侧/上方展示 3-5 本公共领域名著，点击可预览或要求登录后开始阅读。
- 中间是“粘贴一段最近读不顺的日文”的导入框。
- 右侧是“今日复习 / 难词标注 / AI 句子拆解”的轻量预览。

登录后：

- 左栏：虚拟书架 + 自己导入的内容。
- 中栏：当前阅读入口或最近阅读。
- 右栏：今日到期生词、最近 AI 解释、继续阅读。

阅读器：

- 中间阅读区最大，不被工具卡片挤压。
- 顶部提供 `N3+ / N2+ / N1` 难词标注控制。
- token 点击查词，主按钮是“加入生词本”。
- 选句后出现“让 AI 中文拆解这句”，AI 结果侧栏展示翻译、语法、词语拆解和建议生词。

## 5. Functional Plan

### Task 1: Rename And Reposition Public Pages

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/top-nav.tsx`
- Modify: `apps/web/app/pricing/page.tsx`
- Test: `apps/web/e2e/public-pages.spec.ts`

- [ ] 把主品牌从 `Yomuyomu` 改为选定新名，推荐 `Genbun`。
- [ ] 把定位从 `中文母语 N4-N2` 改为 `N2-N1 主力，N3 过渡`。
- [ ] 首页第一屏改成工作台入口，不做大段营销介绍。
- [ ] 首页同时出现“默认书架”和“粘贴片段”两个入口。
- [ ] Pricing 文案从 AI quota 改成“原文阅读 session + 生词留存 + 复习”的价值。
- [ ] 更新 public page E2E 断言。

Verification:

```bash
npm run test:e2e -- public-pages.spec.ts
npm run typecheck:web
```

### Task 2: Add A Lightweight Virtual Bookshelf

**Files:**
- Create: `apps/web/lib/public-books.ts`
- Modify: `apps/web/app/library/page.tsx`
- Potentially modify: `apps/web/app/page.tsx`
- Test: `apps/web/e2e/library-import.spec.ts`

Default candidates:

| Title | Author | Why |
| --- | --- | --- |
| 羅生門 | 芥川 竜之介 | 短篇、经典、适合 N2-N1 精读 |
| 山月記 | 中島 敦 | 汉文感强，适合中文母语高阶用户 |
| 檸檬 | 梶井 基次郎 | 短篇、现代文学表达密度高 |
| こころ | 夏目 漱石 | 长篇，可先展示第一章/节选 |

Sources:

- 青空文庫「羅生門」: https://www.aozora.gr.jp/cards/000879/card127.html
- 青空文庫「山月記」: https://www.aozora.gr.jp/cards/000119/card624.html
- 青空文庫「檸檬」: https://www.aozora.gr.jp/cards/000074/card424.html
- 青空文庫「こころ」: https://www.aozora.gr.jp/cards/000148/card773.html

Implementation:

- [ ] 第一版不要新建复杂 CMS；用 `public-books.ts` 维护 3-5 本书的 metadata 和青空文庫链接。
- [ ] 书架卡片显示标题、作者、推荐难度、预计阅读时间、文本来源。
- [ ] 点击“开始阅读”时，第一版可把内置节选作为 article 创建，复用现有 `createArticle` 入口。
- [ ] 保留用户自己粘贴片段的入口，虚拟书架只是降低空白页阻力。
- [ ] 明确标注来源，不把公共领域内容包装成自有版权内容。

Verification:

```bash
npm run test:e2e -- library-import.spec.ts
npm run typecheck:web
```

### Task 3: Restore Difficulty Annotation As A First-Class Control

**Files:**
- Modify: `apps/web/app/reader/[id]/page.tsx`
- Modify: `apps/web/app/reader/[id]/components/ReaderArticleView.tsx`
- Test: `apps/web/e2e/reader-smoke.spec.ts`

- [ ] 增加 `N3+ / N2+ / N1` segmented control。
- [ ] `N1` 模式只突出 N1 词；`N2+` 突出 N2 和 N1；`N3+` 突出 N3/N2/N1。
- [ ] 保留当前 token 点击查义和加入生词本行为。
- [ ] 添加小型颜色图例，不用大段说明文字。
- [ ] 不改 NLP 后端；当前 token 已带 `jlpt_level`，先在前端过滤显示。

Verification:

```bash
npm run test:e2e -- reader-smoke.spec.ts
npm run typecheck:web
```

### Task 4: Make AI Explanation More Visible

**Files:**
- Modify: `apps/web/app/reader/[id]/page.tsx`
- Modify: `apps/web/app/reader/[id]/components/ExplanationPanel.tsx`
- Test: `apps/web/e2e/reader-smoke.spec.ts`

- [ ] 阅读器右栏默认保留 AI 解释面板入口。
- [ ] 空状态文案改成操作导向：选中一句，再点击“让 AI 中文拆解”。
- [ ] AI 结果优先展示：自然中文释义、直译、语法点、词语拆解、建议生词。
- [ ] 建议生词继续一键加入生词本。
- [ ] 不增加聊天、多轮 tutor、语法课等新模式。

Verification:

```bash
npm run test:e2e -- reader-smoke.spec.ts
npm run typecheck:web
```

### Task 5: Turn Vocab Into The Return Loop

**Files:**
- Modify: `apps/web/app/vocab/page.tsx`
- Test: `apps/web/e2e/vocab-review.spec.ts`

- [ ] 页面顶部突出“今日到期复习”。
- [ ] 保留“今日新增 / 未掌握 / 全部生词”，但视觉权重低于到期复习。
- [ ] 每个词显示来源文章、JLPT level、状态和下一次复习时间。
- [ ] 保留 CSV/JSON 导出；Anki 导出先作为后续项，不在本轮新增。
- [ ] 从阅读器加入的词必须能马上在生词本出现。

Verification:

```bash
npm run test:e2e -- vocab-review.spec.ts
npm run typecheck:web
```

### Task 6: Redesign The App Shell

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/library/page.tsx`
- Modify: `apps/web/app/reader/[id]/page.tsx`
- Modify: `apps/web/app/globals.css`
- Potentially modify: `packages/ui/src/*`

Design direction:

- Aesthetic: quiet literary workstation, not SaaS landing page.
- Layout: full-height app shell, left navigation/book shelf, central reading/import surface, right learning loop.
- Color: paper/off-white background, ink text, restrained accent colors for JLPT levels; avoid purple-blue gradient dominance.
- Typography: readable Japanese text with generous line height; UI text smaller and calmer.
- Cards: only for repeated items such as books or vocab rows; no nested card layout.
- Mobile: stack order should be reading/import first, bookshelf second, review third.

- [ ] First viewport must show actual product state: books, import, reading/review loop.
- [ ] Remove top-centered narrow-page feeling.
- [ ] Keep reading area visually dominant.
- [ ] Use stable dimensions for book cards, controls, token labels and side panels.
- [ ] Add Playwright screenshot checks for desktop and mobile after UI implementation.

Verification:

```bash
npm run typecheck:web
npm run test:e2e
```

Use browser QA after local dev server starts:

- Desktop: homepage, library, reader, vocab.
- Mobile: homepage, library, reader.
- Check no overlapping text, no blank sections, no inaccessible primary actions.

## 6. Additional Features To Consider Later

Only add these after the core redesign works:

- Reading difficulty preview: before opening a book, show N1/N2/N3 density.
- Chapter-sized reading goals: “今天读 800 字” rather than gamified streaks.
- Sentence notebook: save not only words but also example sentences.
- Anki export: likely useful, but wait until users ask twice.
- Genre packs: 文学短篇 / 新闻评论 / JLPT 阅读 / 轻小说风格。
- Domain check: before public launch, check name, domain, and trademark risk.

## 7. Completion Criteria

This improvement is complete only when all are true:

- [ ] Public pages no longer use `有木有木` or `Yomuyomu` as the outward brand.
- [ ] Public positioning says N2-N1 primary, N3 bridge.
- [ ] First screen is a usable workbench, not a narrow marketing page.
- [ ] Library/home includes 3-5 public-domain/default reading candidates.
- [ ] Clicking a default book can start a real reader session.
- [ ] Pasting a custom Japanese passage still works.
- [ ] Reader has visible N3+/N2+/N1 annotation controls.
- [ ] Highlighted tokens can still be clicked and added to vocab.
- [ ] AI explanation flow is visible and works from a selected sentence.
- [ ] Vocab page supports the daily review loop.
- [ ] Desktop and mobile UI are visually checked in browser.
- [ ] Focused E2E/typecheck commands pass, or any failure is documented with root cause.

## 8. Suggested Execution Order

1. Decide name: use `Genbun` unless user chooses another.
2. Implement Task 1 + Task 6 together for the homepage/app shell.
3. Implement Task 2 bookshelf with static metadata and reusable article creation.
4. Implement Task 3 annotation controls.
5. Polish Task 4 AI explanation panel.
6. Polish Task 5 vocab return loop.
7. Run full browser QA and deploy.

