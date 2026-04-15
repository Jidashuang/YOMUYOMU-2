import { expect, test, type Page } from "@playwright/test";

const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8001";

async function stubLibrarySession(page: Page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === "GET" && url.pathname === "/auth/me") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "7d011afd-9f6f-46db-b85d-8d46890dbf42",
          email: "reader@example.com",
          created_at: "2026-03-25T00:00:00Z",
        }),
      });
    }

    if (method === "GET" && url.pathname === "/articles") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    if (method === "POST" && url.pathname === "/auth/logout") {
      return route.fulfill({ status: 204, body: "" });
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: `Unhandled mock: ${method} ${url.pathname}` }),
    });
  });
}

test("library page exposes a dedicated import interface for text and EPUB", async ({ page }) => {
  await stubLibrarySession(page);

  await page.goto("/library");

  await expect(page.getByRole("link", { name: "导入" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "导入与书库" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "导入内容", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "文本" })).toBeVisible();
  await expect(page.getByRole("button", { name: "EPUB" })).toBeVisible();

  await page.getByRole("button", { name: "EPUB" }).click();
  await expect(page.getByText("EPUB 文件")).toBeVisible();
});
