import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("live auth flow uses real API errors and cookie session state", async ({ page }) => {
  const email = `live-auth-${randomUUID()}@example.com`;

  await page.goto("/login");
  await page.getByRole("button", { name: "切换到注册" }).click();

  await page.getByTestId("login-email").fill(email.toUpperCase());
  await page.getByTestId("login-password").fill("password123");
  await page.getByTestId("login-submit").click();

  await expect(page.getByText(/Password is too weak/)).toBeVisible();

  await page.getByTestId("login-password").fill("strong-password-123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByText(email.toLowerCase())).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill("wrong-password-123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Invalid credentials")).toBeVisible();
});
