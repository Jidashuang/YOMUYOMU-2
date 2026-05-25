import { expect, test } from "@playwright/test";

test.describe("public pages positioning", () => {
  test("home page surfaces the Chinese-native N4-N2 wedge in the first viewport", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("home-headline")).toContainText("中文母语");
    await expect(page.getByTestId("home-headline")).toContainText("N4");
    await expect(page.getByTestId("home-headline")).toContainText("N2");

    // First viewport must answer who / what content / what pain.
    await expect(page.getByText("为谁设计")).toBeVisible();
    await expect(page.getByText("你带什么进来")).toBeVisible();
    await expect(page.getByText("解决什么痛")).toBeVisible();

    // Primary CTA pushes users into bringing their own real reading material.
    const importCta = page.getByTestId("home-cta-import");
    await expect(importCta).toBeVisible();
    await expect(importCta).toHaveAttribute("href", "/library");

    // Lightweight naming-risk note while the brand is still Yomuyomu.
    await expect(page.getByText(/名称可能/)).toBeVisible();

    // Navigating from home to pricing should not require authentication.
    await page.getByTestId("home-cta-pricing").click();
    await expect(page).toHaveURL(/\/pricing$/);
  });

  test("pricing page sells the reading workflow outcome, not raw AI quota", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByTestId("pricing-headline")).toContainText("阅读工作流");
    await expect(page.getByTestId("pricing-subhead")).toContainText("中文母语");
    await expect(page.getByTestId("pricing-subhead")).toContainText("N4");

    await expect(page.getByTestId("pricing-plan-free")).toBeVisible();
    await expect(page.getByTestId("pricing-plan-pro")).toBeVisible();

    // Pro plan must describe the reading-workflow outcome rather than promise raw AI calls.
    const pro = page.getByTestId("pricing-plan-pro");
    await expect(pro).toContainText("读不顺");
    await expect(pro).toContainText("生词复习");

    await expect(page.getByTestId("pricing-cta-pro")).toHaveAttribute(
      "href",
      /mailto:hello@yomuyomu.app/
    );
  });

  test("top nav links Pricing and exposes the beta marker", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("top-nav-pricing")).toBeVisible();
    await page.getByTestId("top-nav-pricing").click();
    await expect(page).toHaveURL(/\/pricing$/);
  });
});
