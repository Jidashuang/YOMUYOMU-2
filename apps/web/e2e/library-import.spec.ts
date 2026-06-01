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

    // Replace the sample with a user-supplied passage and import it.
    await page.getByTestId("create-article-title").fill("我的轻小说试读段");
    await page
      .getByTestId("create-article-content")
      .fill("彼は来るはずだったのに、結局あの日は姿を見せなかった。");
    await page.getByTestId("create-article-submit").click();

    // Successful import navigates straight into the reader.
    await expect(page).toHaveURL(new RegExp(`/reader/${articleId}$`));
  });
});
