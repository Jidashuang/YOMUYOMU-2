# First 10 Customers — Yomuyomu 2-Week Validation Workbook

Internal operating doc. Not a product feature. Owned by the founder.

The goal of this workbook is **not** to ship more product. It is to find out
whether 10 narrowly-targeted readers will repeatedly read, save vocab, review,
and pay. If they do not, no amount of feature polish helps yet.

---

## 1. Who counts as a target user (ICP filter)

A person counts only if **all five** are true today:

1. **Native language is Mandarin Chinese** (mainland, TW, HK, SG, overseas — all OK).
2. **Self-declared JLPT level is N4–N2.** Borderline N3↔N2 is fine. N5 is out: they cannot read real material yet. N1 is out: their pain is different.
3. **Already reads real Japanese material at least once a week.** Light novels, web novels, NHK / NHK Easy, JLPT past papers, manga, podcast scripts, Twitter/X JP timelines, ニコニコ / pixiv — any of these. Self-reported "I want to start reading" does not qualify.
4. **Currently uses a tool chain to get through that material**, e.g. some combination of: Yomitan / 10ten Japanese Reader, Anki / Mochi, ChatGPT / Claude / DeepSeek, Jisho / Weblio / 沪江, NHK Easy, browser translation, Kindle, EPUB readers, MoonReader, BookWalker, Twitter machine translation.
5. **Reachable for a 30-minute video call within 7 days.**

If even one of these is false, log them in the "future ICP" list and do **not**
run a session. Mixing them in pollutes the signal.

Recruit 12 to land 10. Drop anyone who fails the filter even after we
"convinced" ourselves they are close. The point of validation is to keep the
ICP narrow.

## 2. Where to look (one wedge per outreach batch)

Pick **one** wedge for the first 10. Do not mix wedges in one batch.

Suggested wedges (rank-ordered for the first batch):

1. **Light novel / web-novel readers** (シリーズもの, syosetu mirror sites, 轻
   小说文库 / 轻之国度 / 哔咔 readers). High pain, high motivation, weekly habit.
2. **JLPT N3–N2 candidates currently in prep cycle.** Easy to find on 沪江
   小D, JLPT 备考 subreddits / 知乎 / 小红书.
3. **NHK / NHK Easy daily readers.** Habit is already daily; check whether
   they want depth beyond NHK Easy.
4. **General web JP readers** (note, Twitter/X, Wikipedia JP). Lowest
   conversion expected; use only if 1–3 are dry.

Pick wedge #1 unless an obvious alternative shows up.

## 3. Outreach message

### Chinese (primary)

> 你好，我在做一个**给中文母语 N4–N2 学习者**的日语原文阅读工具
> Yomuyomu。它专治一种场景：你在读轻小说 / NHK / JLPT 段落时，遇到一句卡
> 住的话，需要在 Yomitan、Anki、ChatGPT、Jisho 之间来回切。
>
> 我现在只在找 10 个真正每周都在读日文的用户做小范围验证（前两周）：
>
> - 把你最近读不顺的一段日文贴进来，我陪你走一遍流程。
> - 我会送你 30 分钟的一对一调试时间，帮你把这段读完。
> - 作为交换，我请你在用完之后告诉我：哪一段没用 / 哪一段省了你的事。
>
> 完全免费，不收信用卡。早期付费名额是 39/月，验证期内锁定 10 位。
>
> 你愿意试试吗？如果可以的话，今天发我一段你最近读不顺的日文就行。

Keep it personalized. Drop "MVP", "platform", "SaaS". Lead with **their**
material and **their** pain.

### English (secondary, for overseas Chinese-speaking communities)

> Hi — I'm building Yomuyomu, a Japanese reading workbench specifically for
> Mandarin-native N4–N2 learners. It targets one moment: when you hit a
> sentence in your light novel / NHK article / JLPT passage and end up
> bouncing between Yomitan, Anki, ChatGPT and Jisho.
>
> For the next 2 weeks I'm only looking for 10 readers who already read real
> Japanese weekly. The deal: bring me a passage you recently struggled with,
> I sit with you for 30 minutes while you read it inside Yomuyomu, and you
> tell me what helped and what didn't. Free. No card. Early paid slots are
> ¥39 / month, locked for the validation cohort.
>
> Want in? Reply with one passage you got stuck on this week and I'll set
> something up.

## 4. Concierge session script (30 min)

Run **before** they touch the product unsupervised. Record the call (with
consent). One founder, one user, no UI walkthrough up front.

### 0. Pre-call (do this when scheduling, not on the call)

- Confirm the user passed all 5 filter criteria. Re-read §1.
- Ask them to bring **the actual passage** they got stuck on.

### 1. First 5 minutes — set frame, do not pitch

- "Today I'm not selling anything. I'm watching you read."
- "I'll only step in if you're stuck for more than 60 seconds."
- "We'll use the passage **you** brought."

### 2. Minutes 5–25 — they read, you observe silently

Watch for these specific events, in this order:

- Did they **paste** their own real passage (vs accept the sample)?
- Did they hit "导入并开始阅读" without help?
- Did they click on a token within the first 90 seconds of reading?
- Did the token popup answer their question, or did they keep looking?
- Did they hit "让 AI 用中文解释这句" at least once during the passage?
- Did the AI answer make them say "啊原来是这样" (or equivalent)?
- Did they save **at least one** vocab item by the end of the passage?
- Did they finish the passage in this session (vs abandon)?

Do not narrate. Do not coach. If they ask "how do I…", answer in one
sentence and stop.

### 3. Minutes 25–30 — three questions, in order

1. "If Yomuyomu disappeared tomorrow, which tool from your current stack
   does it replace? Which does it not replace?"
2. "If I asked you to come back tomorrow and read another passage, which is
   the closest reason you'd say no?"
3. "If this stays free, would you keep using it? If it's ¥39/month after the
   first 2 weeks, would you keep using it?"

Do not ask "would you recommend it" or "do you like it". Compliments are
not signal.

## 5. What to record (every session, same fields)

Keep one row per user, in any sheet you already use. Do not invent a tool.

| Field | Source | Why |
| --- | --- | --- |
| User ID / email | auth | tie-breaker for the analytics events |
| Native language | filter | sanity check on ICP |
| Self-declared level | filter | will be wrong but useful as a band |
| Wedge (light novel / NHK / JLPT / web) | recruitment | so you can compare wedges later |
| Brought their own passage? (Y/N) | observation | the entire validation rests on this |
| Imported without help? (Y/N) | observation | task 2 success criterion |
| First lookup within 90s? (Y/N) | observation | reader UX is doing its job |
| AI explanation invoked at least once? (Y/N) | observation | core value moment |
| Vocab saved during session? (Y/N + count) | observation | retention signal |
| Finished the passage? (Y/N) | observation | completion signal |
| Came back within 3 days? (Y/N) | analytics | second-session signal |
| Reviewed at least once after returning? (Y/N) | `vocab_reviewed` event | retention signal |
| "Replaces which tool?" answer | question 1 | wedge framing |
| "Would say no because…" answer | question 2 | top objection |
| Pay ¥39 if it stays after 2 weeks? (Y/N/Maybe) | question 3 | revenue signal |
| Verbatim quotes (3 max) | recording | for marketing only after pass |

## 6. Pass / fail (behavioral, not opinions)

The 2-week test passes only if **all** of the following are true at the end
of the window:

- ≥10 target users **finished one real passage** of their own material.
- ≥5 of those users **came back within 3 days** to read a second item.
- ≥5 users **saved vocab and completed at least one review action**
  (`vocab_reviewed` event present in analytics, not self-report).
- ≥3 users **paid or explicitly agreed to pay** the early Pro price.
- ≥6 users said Yomuyomu **replaced at least one** tool in their current
  stack (question 1 answer).

If any of these miss, do **not** start more product work. Sit down and
decide whether the wedge is wrong, the ICP is wrong, or the workflow is
wrong. Then run another batch of 10 against the new hypothesis.

## 7. What we explicitly do not do during validation

- Do not add Anki export unless ≥3 users mention it unprompted in their
  question-1 answers.
- Do not add URL import, OCR, or browser extension.
- Do not build mobile native.
- Do not seed a content library.
- Do not chase global / English-speaking learners until the Chinese-native
  wedge clears §6.
- Do not change pricing during the window. Lock ¥39 for the cohort.

## 8. After the 2 weeks

Two outputs only:

1. A one-page memo: "Pass or fail by §6 criteria, with raw numbers."
2. A short list of the next 5 things users actually asked for, ranked by how
   many distinct users asked.

Anything else is procrastination.
