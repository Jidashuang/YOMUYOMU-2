import { expect, test } from "@playwright/test";

test.describe("library import flow as validation entry", () => {
  const API_BASE = "http://localhost:8000";
  const articleId = "11111111-1111-4111-8111-111111111111";
  const blockId = "22222222-2222-4222-8222-222222222222";

  test("first-time user can open a public book or paste a real passage", async ({ page }) => {
    let articles: Array<Record<string, unknown>> = [];

    let article = {
      id: articleId,
      title: "我的轻小说试读段",
      source_type: "text",
      status: "ready",
      processing_error: null,
      created_at: "2026-03-17T00:00:00Z",
      processed_block_count: 1,
      total_block_count: 1,
      raw_content: "彼は来るはずだったのに、結局あの日は姿を見せなかった。",
      normalized_content: "彼は来るはずだったのに、結局あの日は姿を見せなかった。",
      blocks: [
        {
          id: blockId,
          block_index: 0,
          text: "彼は来るはずだったのに、結局あの日は姿を見せなかった。",
          tokens: [],
        },
      ],
    };

    await page.route(`${API_BASE}/**`, async (route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());

      if (method === "POST" && url.pathname === "/auth/login") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "e2e-token",
            token_type: "bearer",
            user: { id: "33333333-3333-4333-8333-333333333333", email: "import@example.com" },
          }),
        });
      }

      if (method === "GET" && url.pathname === "/articles") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(articles) });
      }

      if (method === "POST" && url.pathname === "/articles") {
        const payload = (await request.postDataJSON()) as { title: string; raw_content: string; source_type: string };
        article = {
          ...article,
          title: payload.title,
          source_type: payload.source_type,
          raw_content: payload.raw_content,
          normalized_content: payload.raw_content,
          blocks: [
            {
              id: blockId,
              block_index: 0,
              text: payload.raw_content,
              tokens: [],
            },
          ],
        };
        articles = [
          {
            id: articleId,
            title: payload.title,
            source_type: payload.source_type,
            status: "ready",
            processing_error: null,
            created_at: article.created_at,
            processed_block_count: 1,
            total_block_count: 1,
          },
        ];
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(article) });
      }

      if (method === "GET" && url.pathname === `/articles/${articleId}`) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(article) });
      }

      if (method === "GET" && url.pathname === "/reader-data/highlights") {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }

      if (method === "GET" && url.pathname.startsWith("/reader-data/progress/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      }

      if (method === "GET" && url.pathname === "/ai-explanations") {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }

      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: `Unhandled mock: ${method} ${url.pathname}` }),
      });
    });

    // Login to reach the library page.
    await page.goto("/login");
    await page.getByTestId("login-email").fill("import@example.com");
    await page.getByTestId("login-password").fill("password123");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/library$/);

    // Library now leads with a public-domain shelf plus the user's own real reading material.
    await expect(page.getByRole("heading", { name: /书架与片段精读/ })).toBeVisible();
    await expect(page.getByTestId("library-intro")).toContainText("最近读不顺");
    await expect(page.getByTestId("public-bookshelf")).toContainText("羅生門");

    // A default public-domain book can create a real reader session.
    await page.getByTestId("public-book-start-rashomon").click();
    await expect(page).toHaveURL(new RegExp(`/reader/${articleId}$`));

    await page.goto("/library");

    // Empty state pushes one clear action: paste a real passage.
    await expect(page.getByText("导入一段日文")).toBeVisible();
    await expect(page.getByTestId("source-type-text")).toBeVisible();
    await expect(page.getByTestId("source-type-epub")).toBeVisible();
    await page.getByTestId("source-type-epub").click();
    await expect(page.getByText("EPUB 文件", { exact: true })).toBeVisible();
    await page.getByTestId("epub-file-input").setInputFiles({
      name: "sample.epub",
      mimeType: "application/epub+zip",
      buffer: Buffer.from("epub"),
    });
    await expect(page.getByText("已选择：sample.epub")).toBeVisible();
    await page.getByTestId("epub-file-input").setInputFiles({
      name: "too-large.epub",
      mimeType: "application/epub+zip",
      buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
    });
    await expect(page.getByText("EPUB 文件超过 20MB 限制，请选择更小的文件。")).toBeVisible();
    await page.getByTestId("source-type-text").click();

    // Replace the sample with a user-supplied passage and import it.
    await page.getByTestId("create-article-title").fill("我的轻小说试读段");
    await page
      .getByTestId("create-article-content")
      .fill("彼は来るはずだったのに、結局あの日は姿を見せなかった。");
    await page.getByTestId("create-article-submit").click();

    // Successful import navigates straight into the reader.
    await expect(page).toHaveURL(new RegExp(`/reader/${articleId}$`));
  });

  test("processing book shows progress and already processed reader blocks", async ({ page }) => {
    const failedArticle = {
      id: "99999999-9999-4999-8999-999999999999",
      title: "坏 EPUB",
      source_type: "epub",
      status: "failed",
      processing_error: "Invalid EPUB zip archive",
      created_at: "2026-03-17T00:00:00Z",
      processed_block_count: 0,
      total_block_count: null,
    };
    const processingArticle = {
      id: articleId,
      title: "处理中 EPUB",
      source_type: "epub",
      status: "processing",
      processing_error: null,
      created_at: "2026-03-17T00:00:00Z",
      processed_block_count: 1,
      total_block_count: 3,
      raw_content: "base64:epub",
      normalized_content: "第一章\n彼は来る。",
      blocks: [
        {
          id: blockId,
          block_index: 0,
          text: "第一章",
          tokens: [],
        },
      ],
    };

    await page.route(`${API_BASE}/**`, async (route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());

      if (method === "POST" && url.pathname === "/auth/login") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "e2e-token",
            token_type: "bearer",
            user: { id: "33333333-3333-4333-8333-333333333333", email: "processing@example.com" },
          }),
        });
      }

      if (method === "GET" && url.pathname === "/articles") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: articleId,
              title: processingArticle.title,
              source_type: processingArticle.source_type,
              status: processingArticle.status,
              processing_error: null,
              created_at: processingArticle.created_at,
              processed_block_count: processingArticle.processed_block_count,
              total_block_count: processingArticle.total_block_count,
            },
            failedArticle,
          ]),
        });
      }

      if (method === "GET" && url.pathname === `/articles/${articleId}`) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(processingArticle) });
      }

      if (method === "GET" && url.pathname === "/reader-data/highlights") {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }

      if (method === "GET" && url.pathname.startsWith("/reader-data/progress/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      }

      if (method === "GET" && url.pathname === "/ai-explanations") {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }

      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: `Unhandled mock: ${method} ${url.pathname}` }),
      });
    });

    await page.goto("/login");
    await page.getByTestId("login-email").fill("processing@example.com");
    await page.getByTestId("login-password").fill("password123");
    await page.getByTestId("login-submit").click();

    await expect(page.getByText("处理中 1/3")).toBeVisible();
    await expect(page.getByText("处理失败")).toBeVisible();
    await expect(page.getByText("Invalid EPUB zip archive")).toBeVisible();
    await page
      .getByTestId("article-list-item")
      .filter({ hasText: "处理中 EPUB" })
      .getByRole("link", { name: "继续阅读" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/reader/${articleId}$`));
    await expect(page.getByText("整本 EPUB 正在继续处理：1/3")).toBeVisible();
    await expect(page.getByTestId("reader-article-view")).toContainText("第一章");
  });
});
