import { expect, test, type Page } from "@playwright/test";

const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8001";

async function stubAuthErrors(page: Page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === "GET" && url.pathname === "/auth/me") {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Could not validate credentials" }),
      });
    }

    if (method === "POST" && url.pathname === "/auth/login") {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Invalid credentials",
          code: "invalid_credentials",
        }),
      });
    }

    if (method === "POST" && url.pathname === "/auth/register") {
      return route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          detail: [
            {
              type: "value_error",
              loc: ["body"],
              msg: "Value error, Password is too weak",
              input: {
                email: "weak@example.com",
                password: "password123",
              },
            },
          ],
        }),
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

async function stubRegisterNetworkFailure(page: Page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === "GET" && url.pathname === "/auth/me") {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Could not validate credentials" }),
      });
    }

    if (method === "POST" && url.pathname === "/auth/register") {
      return route.abort("failed");
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

test("login page keeps auth errors on the form", async ({ page }) => {
  await stubAuthErrors(page);
  await page.goto("/login");

  await page.getByTestId("login-email").fill("demo@example.com");
  await page.getByTestId("login-password").fill("wrong-password-123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Invalid credentials")).toBeVisible();
});

test("register page renders validation error details from 422 responses", async ({ page }) => {
  await stubAuthErrors(page);
  await page.goto("/login");

  await page.getByRole("button", { name: "切换到注册" }).click();
  await page.getByTestId("login-email").fill("weak@example.com");
  await page.getByTestId("login-password").fill("password123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/Password is too weak/)).toBeVisible();
});

test("register page shows password requirements before submit", async ({ page }) => {
  await stubAuthErrors(page);
  await page.goto("/login");

  await page.getByRole("button", { name: "切换到注册" }).click();

  await expect(page.getByText("8-128 位字符")).toBeVisible();
  await expect(page.getByText("不能与邮箱相同")).toBeVisible();
  await expect(page.getByText("不能使用常见弱密码")).toBeVisible();
});

test("register page turns fetch failures into an actionable error", async ({ page }) => {
  await stubRegisterNetworkFailure(page);
  await page.goto("/login");

  await page.getByRole("button", { name: "切换到注册" }).click();
  await page.getByTestId("login-email").fill("new-user@example.com");
  await page.getByTestId("login-password").fill("strong-password-123");
  await page.getByTestId("login-submit").click();

  await expect(page.getByText(/无法连接到服务端/)).toBeVisible();
});
