import { expect, test } from "@playwright/test";

// Browser regression with deterministic API fixtures; no backend or paid AI is used.
test("restores and retains the saved page while its blocks load", async ({ page }) => {
  const articleId = "11111111-1111-4111-8111-111111111111";
  const offsets: number[] = [];
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    const reply = (body: unknown) => route.fulfill({ json: body });
    if (url.pathname === "/auth/login") {
      return reply({ access_token: "fixture-token", token_type: "bearer", user: { id: articleId, email: "position@example.com" } });
    }
    if (url.pathname === `/reader-data/progress/${articleId}`) {
      return reply({ article_id: articleId, progress_percent: 75, last_position: "page:1" });
    }
    if (url.pathname === `/articles/${articleId}`) {
      const offset = Number(url.searchParams.get("block_offset") ?? 0);
      offsets.push(offset);
      // Force an uncached page transition instead of winning a prefetch race.
      if (offset > 0) await new Promise((resolve) => setTimeout(resolve, 300));
      return reply({
        id: articleId, title: "阅读位置回归", source_type: "text", status: "ready",
        annotation_status: "ready", processing_error: null, annotation_error: null,
        created_at: "2026-03-17T00:00:00Z", processed_block_count: 36, total_block_count: 36,
        raw_content: "", normalized_content: "",
        blocks: Array.from({ length: 18 }, (_, i) => ({
          id: `block-${offset + i}`, block_index: offset + i,
          text: `第${offset + i + 1}段。`, tokens: [],
        })),
      });
    }
    if (url.pathname === "/reader-data/progress") return reply(route.request().postDataJSON());
    return reply([]);
  });

  await page.goto("/login");
  await page.getByTestId("login-email").fill("position@example.com");
  await page.getByTestId("login-password").fill("fixture-password");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/library$/);
  await page.goto(`/reader/${articleId}`);
  await expect(page.getByTestId("reader-pagination-controls")).toContainText("第 2 / 2 页");
  await expect(page.getByTestId("reader-article-view")).toContainText("第19段。");
  expect(offsets).toContain(18);

  await page.getByTestId("reader-prev-page").click();
  await expect(page.getByTestId("reader-article-view")).toContainText("第1段。");
  await page.getByTestId("reader-next-page").click();
  await expect(page.getByTestId("reader-article-view")).toContainText("第19段。");
  await page.reload();
  await expect(page.getByTestId("reader-pagination-controls")).toContainText("第 2 / 2 页");
  await expect(page.getByTestId("reader-article-view")).toContainText("第19段。");
});
