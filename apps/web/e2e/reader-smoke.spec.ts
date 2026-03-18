import { expect, test } from "@playwright/test";

test("reader critical flow smoke", async ({ page }) => {
  const API_BASE = "http://localhost:8000";

  const articleId = "11111111-1111-4111-8111-111111111111";
  const blockId = "22222222-2222-4222-8222-222222222222";

  const article = {
    id: articleId,
    title: "E2E Article",
    source_type: "text",
    status: "ready",
    processing_error: null,
    created_at: "2026-03-17T00:00:00Z",
    raw_content: "彼は来るはずだったのに。",
    normalized_content: "彼は来るはずだったのに。",
    blocks: [
      {
        id: blockId,
        block_index: 0,
        text: "彼は来るはずだったのに。",
        tokens: [
          { surface: "彼", lemma: "彼", reading: "かれ", pos: "noun", start_offset: 0, end_offset: 1, jlpt_level: "N5", frequency_band: "top-5k" },
          { surface: "は", lemma: "は", reading: "は", pos: "助詞", start_offset: 1, end_offset: 2, jlpt_level: "Unknown", frequency_band: "Unknown" },
          { surface: "来る", lemma: "来る", reading: "くる", pos: "verb", start_offset: 2, end_offset: 4, jlpt_level: "N5", frequency_band: "top-1k" },
          { surface: "はず", lemma: "はず", reading: "はず", pos: "noun", start_offset: 4, end_offset: 6, jlpt_level: "N3", frequency_band: "top-10k" },
          { surface: "だった", lemma: "だ", reading: "だった", pos: "助動詞", start_offset: 6, end_offset: 9, jlpt_level: "Unknown", frequency_band: "Unknown" },
          { surface: "のに", lemma: "のに", reading: "のに", pos: "助詞", start_offset: 9, end_offset: 11, jlpt_level: "N3", frequency_band: "top-10k" },
          { surface: "。", lemma: "。", reading: "。", pos: "記号", start_offset: 11, end_offset: 12, jlpt_level: "Unknown", frequency_band: "Unknown" },
        ],
      },
    ],
  };

  const lookupEntries = {
    entries: [
      {
        lemma: "来る",
        reading: "くる",
        pos: ["verb"],
        meanings: ["to come", "to arrive"],
        primary_meaning: "to come",
        jlpt_level: "N5",
        frequency_band: "top-1k",
      },
      {
        lemma: "来る",
        reading: "きたる",
        pos: ["verb"],
        meanings: ["to come (literary)"],
        primary_meaning: "to come (literary)",
        jlpt_level: "N2",
        frequency_band: "outside-10k",
      },
    ],
  };

  let highlights: Array<Record<string, unknown>> = [];
  let aiHistory: Array<Record<string, unknown>> = [];
  let progress: Record<string, unknown> | null = null;

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    const json = async () => {
      const body = request.postData() ?? "{}";
      return JSON.parse(body);
    };

    if (method === "POST" && url.pathname === "/auth/login") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "e2e-token",
          token_type: "bearer",
          user: { id: "33333333-3333-4333-8333-333333333333", email: "e2e@example.com" },
        }),
      });
    }

    if (method === "GET" && url.pathname === "/articles") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: articleId, title: article.title, source_type: "text", status: "ready", processing_error: null, created_at: article.created_at }]) });
    }

    if (method === "POST" && url.pathname === "/articles") {
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(article) });
    }

    if (method === "GET" && url.pathname === `/articles/${articleId}`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(article) });
    }

    if (method === "POST" && url.pathname === "/reader-data/lookup") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lookupEntries) });
    }

    if (method === "GET" && url.pathname === "/reader-data/highlights") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(highlights) });
    }

    if (method === "POST" && url.pathname === "/reader-data/highlights") {
      const payload = await json();
      const created = {
        id: "44444444-4444-4444-8444-444444444444",
        article_id: payload.article_id,
        block_id: payload.block_id,
        start_offset_in_block: payload.start_offset_in_block,
        end_offset_in_block: payload.end_offset_in_block,
        text_quote: payload.text_quote,
        note: payload.note ?? null,
        created_at: "2026-03-17T00:00:00Z",
      };
      highlights = [created, ...highlights];
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
    }

    if (method === "PATCH" && url.pathname.startsWith("/reader-data/highlights/")) {
      const payload = await json();
      const id = url.pathname.split("/")[3];
      highlights = highlights.map((item) => (item.id === id ? { ...item, note: payload.note } : item));
      const updated = highlights.find((item) => item.id === id);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(updated) });
    }

    if (method === "POST" && url.pathname === "/reader-data/vocab") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "55555555-5555-4555-8555-555555555555",
          surface: "来る",
          lemma: "来る",
          reading: "くる",
          pos: "verb",
          meaning_snapshot: { meanings: ["to come"] },
          jlpt_level: "N5",
          frequency_band: "top-1k",
          source_article_id: articleId,
          source_sentence: "彼は来るはずだったのに。",
          created_at: "2026-03-17T00:00:00Z",
        }),
      });
    }

    if (method === "POST" && url.pathname === "/ai-explanations") {
      const created = {
        id: "66666666-6666-4666-8666-666666666666",
        article_id: articleId,
        highlight_id: null,
        sentence: "彼は来るはずだったのに。",
        model: "gpt-4.1-mini",
        provider: "openai",
        prompt_version: "v2",
        error_type: null,
        provider_latency_ms: 420.2,
        prompt_tokens: 120,
        completion_tokens: 220,
        total_tokens: 340,
        from_cache: false,
        response_json: {
          translation_zh: "他本该来的，可是没有来。",
          literal_translation: "他 来 应该 的却。",
          grammar_points: [
            { name: "はず", explanation: "表达预期" },
            { name: "のに", explanation: "表达转折" },
          ],
          token_breakdown: [
            { surface: "来る", lemma: "来る", reading: "くる", meaning: "来", role: "谓语" },
          ],
          omissions: [],
          nuance: "带有失望语气",
          examples: [{ jp: "来るはずだ。", zh: "按理会来。" }],
        },
        tokenized_result: [],
        dictionary_hints: [],
        created_at: "2026-03-17T00:00:00Z",
      };
      aiHistory = [created, ...aiHistory];
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
    }

    if (method === "GET" && url.pathname === "/ai-explanations") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(aiHistory) });
    }

    if (method === "POST" && url.pathname === "/reader-data/progress") {
      const payload = await json();
      progress = {
        id: "77777777-7777-4777-8777-777777777777",
        article_id: payload.article_id,
        progress_percent: payload.progress_percent,
        last_position: payload.last_position,
        updated_at: "2026-03-17T00:00:00Z",
      };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(progress) });
    }

    if (method === "GET" && url.pathname === `/reader-data/progress/${articleId}`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(progress) });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: `Unhandled mock: ${method} ${url.pathname}` }) });
  });

  await page.goto("/login");
  await page.getByTestId("login-email").fill("e2e@example.com");
  await page.getByTestId("login-password").fill("password123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/library$/);

  await page.getByTestId("create-article-title").fill("E2E Reader Flow");
  await page.getByTestId("create-article-content").fill("彼は来るはずだったのに。");
  await page.getByTestId("create-article-submit").click();

  await expect(page).toHaveURL(new RegExp(`/reader/${articleId}$`));
  await expect(page.getByTestId("reader-article-view")).toBeVisible();

  await page.locator("[data-testid='reader-token']", { hasText: "来る" }).first().click();
  await expect(page.getByTestId("token-popup")).toBeVisible();
  await expect(page.getByTestId("token-popup")).toContainText("primary_meaning");
  await page
    .getByTestId("token-popup-add-vocab")
    .evaluate((element) => (element as HTMLButtonElement).click());

  await page.evaluate(() => {
    const tokens = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='reader-token']"));
    const start = tokens.find((item) => item.textContent === "来る");
    const end = tokens.find((item) => item.textContent === "はず");
    if (!start || !end || !start.firstChild || !end.firstChild) {
      throw new Error("Cannot prepare range for highlight");
    }
    const range = document.createRange();
    range.setStart(start.firstChild, 0);
    range.setEnd(end.firstChild, end.textContent?.length ?? 0);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.locator("[data-testid='reader-token']", { hasText: "来る" }).first().dispatchEvent("mouseup");

  await expect(page.getByTestId("highlight-menu")).toBeVisible();
  await page.getByTestId("highlight-menu-ai").click();

  await expect(page.getByTestId("explanation-panel")).toBeVisible();
  await expect(page.getByTestId("explanation-translation")).toContainText("translation_zh");
  await expect(page.getByTestId("explanation-literal")).toContainText("literal_translation");
  await expect(page.getByTestId("explanation-grammar-points")).toBeVisible();
  await expect(page.getByTestId("explanation-token-breakdown")).toBeVisible();
  await expect(page.getByTestId("explanation-examples")).toBeVisible();

  await page.evaluate(() => {
    const tokens = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='reader-token']"));
    const start = tokens.find((item) => item.textContent === "来る");
    const end = tokens.find((item) => item.textContent === "はず");
    if (!start || !end || !start.firstChild || !end.firstChild) {
      throw new Error("Cannot prepare range for favorite highlight");
    }
    const range = document.createRange();
    range.setStart(start.firstChild, 0);
    range.setEnd(end.firstChild, end.textContent?.length ?? 0);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.locator("[data-testid='reader-token']", { hasText: "来る" }).first().dispatchEvent("mouseup");
  await page.getByTestId("highlight-menu-favorite").click();

  await expect(page.getByTestId("highlight-list")).toContainText("来るはず");

  await page.reload();

  await expect(page.getByTestId("highlight-list")).toContainText("来るはず");
  const tokenHighlighted = await page.locator("[data-testid='reader-token']", { hasText: "来る" }).first().evaluate((node) =>
    node.className.includes("bg-yellow")
  );
  expect(tokenHighlighted).toBeTruthy();
});
