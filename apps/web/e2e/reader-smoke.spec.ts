import { expect, test, type Page } from "@playwright/test";

const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8001";
const API_HOSTS = [new URL(API_BASE).host, "localhost:8001", "127.0.0.1:8001"];

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

function buildLongArticle(blockCount = 10) {
  return {
    ...article,
    blocks: Array.from({ length: blockCount }, (_, index) => ({
      ...article.blocks[0],
      id: `${blockId}-${index + 1}`,
      block_index: index,
    })),
  };
}

async function stubReaderApi(
  page: Page,
  options?: {
    articleOverride?: typeof article;
    initialProgress?: { progress_percent: number; last_position: string } | null;
  }
) {
  const activeArticle = options?.articleOverride ?? article;
  let sessionUser: { id: string; email: string; created_at: string } | null = null;
  let highlights: Array<Record<string, unknown>> = [];
  let aiHistory: Array<Record<string, unknown>> = [];
  let progress: Record<string, unknown> | null = options?.initialProgress
    ? {
        id: "77777777-7777-4777-8777-777777777777",
        article_id: articleId,
        progress_percent: options.initialProgress.progress_percent,
        last_position: options.initialProgress.last_position,
        updated_at: "2026-03-17T00:00:00Z",
      }
    : null;

  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (!API_HOSTS.includes(url.host)) {
      return route.continue();
    }

    const json = async () => {
      const body = request.postData() ?? "{}";
      return JSON.parse(body);
    };

    if (method === "POST" && url.pathname === "/auth/login") {
      sessionUser = {
        id: "33333333-3333-4333-8333-333333333333",
        email: "e2e@example.com",
        created_at: "2026-03-17T00:00:00Z",
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: sessionUser.id, email: sessionUser.email },
        }),
      });
    }

    if (method === "GET" && url.pathname === "/auth/me") {
      if (sessionUser) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(sessionUser),
        });
      }
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Could not validate credentials" }),
      });
    }

    if (method === "POST" && url.pathname === "/auth/logout") {
      sessionUser = null;
      return route.fulfill({ status: 204, body: "" });
    }

    if (method === "GET" && url.pathname === "/articles") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: articleId,
            title: activeArticle.title,
            source_type: "text",
            status: "ready",
            processing_error: null,
            created_at: activeArticle.created_at,
          },
        ]),
      });
    }

    if (method === "POST" && url.pathname === "/articles") {
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(activeArticle) });
    }

    if (method === "GET" && url.pathname === `/articles/${articleId}`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(activeArticle) });
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
          why_this_expression: "句子用はず表达预期，用のに表达结果落空。",
          alternative_expressions: [{ jp: "来ると思ったのに。", zh: "本以为他会来。", note: "更口语化。" }],
          examples: [{ jp: "来るはずだ。", zh: "按理会来。" }],
        },
        tokenized_result: [],
        dictionary_hints: [],
        suggested_vocab: [
          {
            surface: "はず",
            lemma: "はず",
            reading: "はず",
            pos: "noun",
            meaning: "按理说；理应",
            jlpt_level: "N3",
            frequency_band: "top-10k",
          },
        ],
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

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: `Unhandled mock: ${method} ${url.pathname}` }),
    });
  });
}

async function loginAndOpenReader(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill("e2e@example.com");
  await page.getByTestId("login-password").fill("strong-password-123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/library$/);

  await page.getByTestId("create-article-title").fill("E2E Reader Flow");
  await page.getByTestId("create-article-content").fill("彼は来るはずだったのに。");
  await page.getByTestId("create-article-submit").click();

  await expect(page).toHaveURL(new RegExp(`/reader/${articleId}$`));
  await expect(page.getByTestId("reader-article-view")).toBeVisible();
}

async function prepareSelection(page: Page) {
  await page.evaluate(() => {
    const tokens = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='reader-token']"));
    const visibleTokens = tokens.filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.bottom >= 0 && rect.top <= window.innerHeight;
    });
    const selectionPool = visibleTokens.length > 0 ? visibleTokens : tokens;
    const start = selectionPool.find((item) => item.textContent === "来る");
    const end = selectionPool.find((item) => item.textContent === "はず");
    if (!start || !end || !start.firstChild || !end.firstChild) {
      throw new Error("Cannot prepare range for highlight");
    }
    const range = document.createRange();
    range.setStart(start.firstChild, 0);
    range.setEnd(end.firstChild, end.textContent?.length ?? 0);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    start.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}

test("reader tokens expose keyboard access for word details", async ({ page }) => {
  await stubReaderApi(page);
  await loginAndOpenReader(page);

  const token = page.getByRole("button", { name: /来る/ }).first();
  await expect(token).toBeVisible();
  await token.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("dialog", { name: "单词详情" })).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭单词详情" })).toBeFocused();
});

test("token popup closes on escape and restores focus to the originating token", async ({ page }) => {
  await stubReaderApi(page);
  await loginAndOpenReader(page);

  const token = page.getByRole("button", { name: /来る/ }).first();
  await token.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("dialog", { name: "单词详情" })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog", { name: "单词详情" })).toBeHidden();
  await expect(token).toBeFocused();
});

test("reader live region updates twice for identical success messages", async ({ page }) => {
  await stubReaderApi(page);
  await loginAndOpenReader(page);

  await page.evaluate(() => {
    const liveRegion = document.querySelector<HTMLElement>("[data-testid='reader-live-region']");
    if (!liveRegion) {
      throw new Error("Live region not found");
    }

    const updates: string[] = [];
    const observer = new MutationObserver(() => {
      updates.push(liveRegion.textContent ?? "");
    });

    observer.observe(liveRegion, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    (window as Window & { __readerLiveRegionUpdates?: string[] }).__readerLiveRegionUpdates = updates;
  });

  await page.locator("[data-testid='reader-token']", { hasText: "来る" }).first().click();
  const addButton = page.getByTestId("token-popup-add-vocab");
  await expect(addButton).toBeVisible();

  await addButton.click();
  await expect(page.getByTestId("reader-live-region")).toContainText("已加入生词本");
  await expect(addButton).toBeEnabled();

  await addButton.click();
  await expect(page.getByTestId("reader-live-region")).toContainText("已加入生词本");

  await page.waitForFunction(() => {
    const updates = (window as Window & { __readerLiveRegionUpdates?: string[] }).__readerLiveRegionUpdates ?? [];
    return updates.filter((entry) => entry.includes("已加入生词本")).length >= 2;
  });
});

test("reader page prioritizes article context and ai learning summary", async ({ page }) => {
  await stubReaderApi(page);
  await loginAndOpenReader(page);

  await expect(page.getByTestId("reader-shell")).toBeVisible();
  await expect(page.getByTestId("reader-sidebar")).toBeVisible();
  await expect(page.getByTestId("reader-article-title")).toContainText("E2E Article");

  await prepareSelection(page);
  await page.getByTestId("highlight-menu-ai").click();

  await expect(page.getByTestId("explanation-summary")).toBeVisible();
  await expect(page.getByTestId("explanation-summary")).toContainText("他本该来的，可是没有来。");
  await expect(page.getByRole("button", { name: "查看解释元信息" })).toBeVisible();
  await expect(page.getByRole("button", { name: "展开历史解释" })).toBeVisible();
});

test("reader links saved highlights back to article context and tracks reading position", async ({ page }) => {
  await stubReaderApi(page, { articleOverride: buildLongArticle(14) });
  await loginAndOpenReader(page);

  await expect(page.getByTestId("reader-progress-current")).toContainText("0%");

  await page.evaluate(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
  });

  await expect(page.getByTestId("reader-progress-current")).toHaveText(/^(?:[1-9]\d?|100)%$/);

  await prepareSelection(page);
  await page.getByTestId("highlight-menu-favorite").click();

  await expect(page.getByRole("button", { name: "返回正文位置" })).toBeVisible();
});

test("reader action menu restores focus and announces saved highlights", async ({ page }) => {
  await stubReaderApi(page);
  await loginAndOpenReader(page);

  const token = page.getByRole("button", { name: /来る/ }).first();
  await token.focus();
  await page.keyboard.press("Shift+F10");

  const dialog = page.getByRole("dialog", { name: "选区操作" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭选区操作" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(token).toBeFocused();

  await page.keyboard.press("Shift+F10");
  await page.getByRole("button", { name: "加入收藏" }).click();

  await expect(page.getByTestId("reader-live-region")).toContainText("已保存高亮");
  await expect(page.getByTestId("highlight-list")).toContainText("来る");
  await expect(token).toBeFocused();
});

test("reader critical flow smoke", async ({ page }) => {
  await stubReaderApi(page);
  await loginAndOpenReader(page);

  await page.locator("[data-testid='reader-token']", { hasText: "来る" }).first().click();
  await expect(page.getByTestId("token-popup")).toBeVisible();
  await expect(page.getByTestId("token-popup")).toContainText("primary_meaning");
  await page.getByTestId("token-popup-add-vocab").evaluate((element) => (element as HTMLButtonElement).click());

  await prepareSelection(page);

  await expect(page.getByTestId("highlight-menu")).toBeVisible();
  await page.getByTestId("highlight-menu-ai").click();

  await expect(page.getByTestId("explanation-panel")).toBeVisible();
  await expect(page.getByTestId("explanation-summary")).toContainText("他本该来的，可是没有来。");
  await page.getByRole("button", { name: "查看解释元信息" }).click();
  await expect(page.getByTestId("explanation-translation")).toContainText("他本该来的，可是没有来。");
  await expect(page.getByTestId("explanation-literal")).toContainText("literal_translation");
  await expect(page.getByTestId("explanation-grammar-points")).toBeVisible();
  await expect(page.getByTestId("explanation-token-breakdown")).toBeVisible();
  await expect(page.getByTestId("explanation-examples")).toBeVisible();

  const actionToken = page.getByRole("button", { name: /来る/ }).first();
  await actionToken.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByTestId("highlight-menu")).toBeVisible();
  await page.getByTestId("highlight-menu-favorite").evaluate((element) => (element as HTMLButtonElement).click());

  await expect(page.getByTestId("highlight-list")).toContainText("来る");
  const tokenHighlighted = await page.locator("[data-testid='reader-token']", { hasText: "来る" }).first().evaluate((node) =>
    node.className.includes("bg-yellow")
  );
  expect(tokenHighlighted).toBeTruthy();
});
