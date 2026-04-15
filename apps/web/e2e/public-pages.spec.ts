import { expect, test, type Page } from "@playwright/test";

const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8001";

async function stubLoggedOutSession(page: Page) {
  await page.route(`${API_BASE}/auth/me`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Could not validate credentials" }),
    });
  });
}

test("public homepage routes users into pricing and legal pages", async ({ page }) => {
  await stubLoggedOutSession(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "读原文，不丢词。" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看定价" })).toBeVisible();
  await expect(page.getByRole("link", { name: "免费注册" })).toBeVisible();

  await page.getByRole("link", { name: "查看定价" }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
  await expect(page.getByText("Starter")).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText("我们收集哪些数据")).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms" })).toBeVisible();
  await expect(page.getByText("可接受使用")).toBeVisible();
});

test("public homepage uses a full-bleed layout on wide screens", async ({ page }) => {
  await stubLoggedOutSession(page);
  await page.setViewportSize({ width: 1600, height: 1000 });

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");

  const heroBox = await page.locator(".landing-hero").boundingBox();
  expect(heroBox).not.toBeNull();
  expect(heroBox!.width).toBeGreaterThan(1450);
});
