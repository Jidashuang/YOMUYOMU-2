import { expect, test } from "@playwright/test";

test.describe("public pages positioning", () => {
  test("home page surfaces the Genbun N2-N1 original-reading workbench", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("top-nav-home")).toContainText("Genbun");
    await expect(page.getByTestId("home-headline")).toContainText("N2");
    await expect(page.getByTestId("home-headline")).toContainText("N1");
    await expect(page.getByTestId("home-subhead")).toContainText("N3+");

    // First viewport must show the actual workbench: shelf, import entry, and learning loop.
    await expect(page.getByTestId("home-public-books")).toContainText("羅生門");
    await expect(page.getByText("难词标注")).toBeVisible();
    await expect(page.getByText("AI 句子拆解")).toBeVisible();
    await expect(page.getByText("生词回流")).toBeVisible();

    // Primary CTA pushes users into bringing their own real reading material.
    const importCta = page.getByTestId("home-cta-import");
    await expect(importCta).toBeVisible();
    await expect(importCta).toHaveAttribute("href", "/library");

    await expect(page.getByText("Genbun · 日文原文阅读工作台")).toBeVisible();

    // Navigating from home to pricing should not require authentication.
    await page.getByTestId("home-cta-pricing").click();
    await expect(page).toHaveURL(/\/pricing$/);
  });

  test("pricing page sells the reading workflow outcome, not raw AI quota", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByTestId("pricing-headline")).toContainText("原文阅读工作流");
    await expect(page.getByTestId("pricing-subhead")).toContainText("Genbun");
    await expect(page.getByTestId("pricing-subhead")).toContainText("N2");
    await expect(page.getByTestId("pricing-subhead")).toContainText("N1");

    await expect(page.getByTestId("pricing-plan-free")).toBeVisible();
    await expect(page.getByTestId("pricing-plan-pro")).toBeVisible();

    // Pro plan must describe the reading-workflow outcome rather than promise raw AI calls.
    const pro = page.getByTestId("pricing-plan-pro");
    await expect(pro).toContainText("读不顺");
    await expect(pro).toContainText("生词复习");

    await expect(page.getByTestId("pricing-cta-pro")).toHaveAttribute(
      "href",
      /mailto:hello@genbun\.app/
    );
  });

  test("top nav links Pricing and exposes the Genbun beta marker", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("top-nav-home")).toContainText("Genbun");
    await expect(page.getByTestId("top-nav-pricing")).toBeVisible();
    await page.getByTestId("top-nav-pricing").click();
    await expect(page).toHaveURL(/\/pricing$/);
  });
});
