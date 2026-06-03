#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_EMAIL = "article-verify@example.com";
const DEFAULT_PASSWORD = "password123";
const DEFAULT_TIMEOUT_MS = 90000;
const EPUB_BASE64 = [
  "UEsDBBQAAAAAAHuxwlxvYassFAAAABQAAAAIAAAAbWltZXR5cGVhcHBsaWNhdGlvbi9lcHViK3ppcFBLAwQUAAAAAAB7scJcHkBH+PQAAAD0AAAAFgAAAE1FVEEtSU5GL2NvbnRhaW5lci54bWw8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCI/Pgo8Y29udGFpbmVyIHZlcnNpb249IjEuMCIgeG1sbnM9InVybjpvYXNpczpuYW1lczp0YzpvcGVuZG9jdW1lbnQ6eG1sbnM6Y29udGFpbmVyIj4KICA8cm9vdGZpbGVzPjxyb290ZmlsZSBmdWxsLXBhdGg9Ik9FQlBTL2NvbnRlbnQub3BmIiBtZWRpYS10eXBlPSJhcHBsaWNhdGlvbi9vZWJwcy1wYWNrYWdlK3htbCIvPjwvcm9vdGZpbGVzPgo8L2NvbnRhaW5lcj4KUEsDBBQAAAAAAHuxwlwrwQdyeAEAAHgBAAARAAAAT0VCUFMvY29udGVudC5vcGY8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCI/Pgo8cGFja2FnZSB4bWxucz0iaHR0cDovL3d3dy5pZHBmLm9yZy8yMDA3L29wZiIgdmVyc2lvbj0iMy4wIj4KICA8bWFuaWZlc3Q+CiAgICA8aXRlbSBpZD0iY2hhcHRlcjEiIGhyZWY9ImNoYXB0ZXIxLnhodG1sIiBtZWRpYS10eXBlPSJhcHBsaWNhdGlvbi94aHRtbCt4bWwiLz4KICAgIDxpdGVtIGlkPSJjaGFwdGVyMiIgaHJlZj0iY2hhcHRlcjIueGh0bWwiIG1lZGlhLXR5cGU9ImFwcGxpY2F0aW9uL3hodG1sK3htbCIvPgogIDwvbWFuaWZlc3Q+CiAgPHNwaW5lPjxpdGVtcmVmIGlkcmVmPSJjaGFwdGVyMSIvPjxpdGVtcmVmIGlkcmVmPSJjaGFwdGVyMiIvPjwvc3BpbmU+CjwvcGFja2FnZT4KUEsDBBQAAAAAAHuxwlwxn45+pAAAAKQAAAAUAAAAT0VCUFMvY2hhcHRlcjEueGh0bWw8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCI/Pgo8aHRtbCB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCI+PGJvZHk+PGgxPuesrOS4gOeroDwvaDE+PHA+5b2844Gv5p2l44KL44Gv44Ga44Gg44Gj44Gf44Gu44Gr44CCPC9wPjwvYm9keT48L2h0bWw+ClBLAwQUAAAAAAB7scJcNllIAKEAAAChAAAAFAAAAE9FQlBTL2NoYXB0ZXIyLnhodG1sPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPGh0bWwgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwiPjxib2R5PjxoMT7nrKzkuoznq6A8L2gxPjxwPuS7iuaXpeOBr+mbqOOBjOmZjeOBo+OBpuOBhOOCi+OAgjwvcD48L2JvZHk+PC9odG1sPgpQSwECFAMUAAAAAAB7scJcb2GrLBQAAAAUAAAACAAAAAAAAAAAAAAAgAEAAAAAbWltZXR5cGVQSwECFAMUAAAAAAB7scJcHkBH+PQAAAD0AAAAFgAAAAAAAAAAAAAAgAE6AAAATUVUQS1JTkYvY29udGFpbmVyLnhtbFBLAQIUAxQAAAAAAHuxwlwrwQdyeAEAAHgBAAARAAAAAAAAAAAAAACAAWIBAABPRUJQUy9jb250ZW50Lm9wZlBLAQIUAxQAAAAAAHuxwlwxn45+pAAAAKQAAAAUAAAAAAAAAAAAAACAAQkDAABPRUJQUy9jaGFwdGVyMS54aHRtbFBLAQIUAxQAAAAAAHuxwlw2WUgAoQAAAKEAAAAUAAAAAAAAAAAAAACAAd8DAABPRUJQUy9jaGFwdGVyMi54aHRtbFBLBQYAAAAABQAFAD0BAACyBAAAAAA=",
].join("");

function usage() {
  console.log(`Usage: node scripts/verify_web_epub_flow.mjs --web-base-url http://VM_IP [options]

Options:
  --api-base-url URL   API base URL. Defaults to WEB_BASE_URL/api.
  --email EMAIL        Verification account email. Defaults to ${DEFAULT_EMAIL}.
  --password PASSWORD  Verification account password.
  --timeout MS         Browser/API timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}.
  --headful            Run Chromium with a visible window.
  --keep-article       Keep the created verification article after a successful run.
`);
}

function parseArgs(argv) {
  const args = {
    webBaseUrl: "",
    apiBaseUrl: "",
    email: DEFAULT_EMAIL,
    password: DEFAULT_PASSWORD,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    headful: false,
    keepArticle: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--help" || item === "-h") {
      usage();
      process.exit(0);
    }
    if (item === "--headful") {
      args.headful = true;
      continue;
    }
    if (item === "--keep-article") {
      args.keepArticle = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${item}`);
    }
    i += 1;
    if (item === "--web-base-url") args.webBaseUrl = value;
    else if (item === "--api-base-url") args.apiBaseUrl = value;
    else if (item === "--email") args.email = value;
    else if (item === "--password") args.password = value;
    else if (item === "--timeout") args.timeoutMs = Number(value);
    else throw new Error(`Unknown argument: ${item}`);
  }

  if (!args.webBaseUrl) {
    throw new Error("--web-base-url is required");
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout must be a positive number");
  }
  args.webBaseUrl = normalizeBaseUrl(args.webBaseUrl);
  args.apiBaseUrl = normalizeBaseUrl(args.apiBaseUrl || new URL("/api", `${args.webBaseUrl}/`).toString());
  return args;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

async function loadChromium() {
  try {
    const mod = await import("@playwright/test");
    return mod.chromium;
  } catch (error) {
    throw new Error(`Playwright is required. Run npm ci and npx playwright install chromium. ${error.message}`);
  }
}

async function requestJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let payload = null;
    if (text) {
      payload = JSON.parse(text);
    }
    return { status: response.status, ok: response.ok, text, payload };
  } finally {
    clearTimeout(timer);
  }
}

async function ensureAuth(args) {
  const payload = JSON.stringify({ email: args.email, password: args.password });
  const headers = { "Content-Type": "application/json" };
  const register = await requestJson(
    `${args.apiBaseUrl}/auth/register`,
    { method: "POST", headers, body: payload },
    args.timeoutMs
  );
  if (![201, 409].includes(register.status)) {
    throw new Error(`register failed: ${register.status} ${register.text}`);
  }

  const login = await requestJson(
    `${args.apiBaseUrl}/auth/login`,
    { method: "POST", headers, body: payload },
    args.timeoutMs
  );
  if (login.status !== 200 || !login.payload?.access_token || !login.payload?.user) {
    throw new Error(`login failed: ${login.status} ${login.text}`);
  }
  return { token: login.payload.access_token, user: login.payload.user };
}

async function deleteArticle(args, token, articleId) {
  const response = await requestJson(
    `${args.apiBaseUrl}/articles/${articleId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    args.timeoutMs
  );
  if (![200, 204, 404].includes(response.status)) {
    throw new Error(`delete article failed: ${response.status} ${response.text}`);
  }
}

async function waitForLocatorText(locator, expectedText, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await locator.textContent({ timeout: 2000 }).catch(() => "");
    if (text.includes(expectedText)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for text: ${expectedText}`);
}

async function waitForHydration(page) {
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
}

async function launchChromium(chromium, args) {
  try {
    return await chromium.launch({ headless: !args.headful });
  } catch (error) {
    if (args.headful || !String(error.message).includes("chromium_headless_shell")) {
      throw error;
    }
    return await chromium.launch({ headless: true, channel: "chromium" });
  }
}

async function run(args) {
  const chromium = await loadChromium();
  const auth = await ensureAuth(args);
  const epubPath = path.join(os.tmpdir(), "yomuyomu-live-verify.epub");
  await fs.writeFile(epubPath, Buffer.from(EPUB_BASE64, "base64"));

  const browser = await launchChromium(chromium, args);
  let articleId = "";
  let processingBannerObserved = false;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(args.timeoutMs);

    await page.goto(`${args.webBaseUrl}/login`, { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await page.getByTestId("login-email").fill(args.email);
    await page.getByTestId("login-password").fill(args.password);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/library$/, { timeout: args.timeoutMs });
    await page.goto(`${args.webBaseUrl}/library`, { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await page.getByTestId("source-type-epub").click();
    await page.getByTestId("epub-file-input").setInputFiles(epubPath);
    await waitForLocatorText(page.locator("body"), "已选择：yomuyomu-live-verify.epub", args.timeoutMs);
    await page.getByTestId("create-article-title").fill("live EPUB import verify");
    await page.getByTestId("create-article-submit").click();
    await page.waitForURL(/\/reader\/[0-9a-f-]+$/i, { timeout: args.timeoutMs });

    articleId = new URL(page.url()).pathname.split("/").pop() || "";
    if (!articleId) {
      throw new Error(`Could not extract article id from URL: ${page.url()}`);
    }

    try {
      await page.getByTestId("reader-processing-banner").waitFor({ state: "visible", timeout: 10000 });
      processingBannerObserved = true;
    } catch {
      processingBannerObserved = false;
    }

    const articleView = page.getByTestId("reader-article-view");
    await waitForLocatorText(articleView, "第一章", args.timeoutMs);
    await waitForLocatorText(articleView, "第二章", args.timeoutMs);

    const readerTokens = page.getByTestId("reader-token");
    await readerTokens.first().waitFor({ state: "visible", timeout: args.timeoutMs });
    const tokenCount = await readerTokens.count();
    const artificialSpacingToken = await readerTokens.evaluateAll((nodes) =>
      nodes
        .map((node) => node.className || "")
        .find((className) => className.includes("mx-") || className.includes("px-0.5"))
    );
    if (artificialSpacingToken) {
      throw new Error(`Reader token still has artificial spacing classes: ${artificialSpacingToken}`);
    }
    const coloredTokenInfo = await readerTokens.evaluateAll((nodes) =>
      nodes
        .map((node, index) => ({ index, text: node.textContent?.trim() || "", className: node.className || "" }))
        .find((item) => /bg-(sky|amber|rose|stone)/.test(item.className))
    );
    if (!coloredTokenInfo) {
      throw new Error("Reader rendered clickable tokens but no difficulty color marker");
    }
    const tokenInfo = await readerTokens.evaluateAll((nodes) =>
      nodes
        .map((node, index) => ({ index, text: node.textContent?.trim() || "" }))
        .find((item) => item.text.length > 0)
    );
    if (!tokenInfo) {
      throw new Error("Reader rendered no clickable tokens");
    }
    await readerTokens.nth(tokenInfo.index).click();
    const tokenPopup = page.getByTestId("token-popup");
    await tokenPopup.waitFor({ state: "visible", timeout: args.timeoutMs });
    await waitForLocatorText(tokenPopup, tokenInfo.text, args.timeoutMs);

    const cleanup = { deleted_article: false, error: null };
    if (!args.keepArticle) {
      try {
        await deleteArticle(args, auth.token, articleId);
        cleanup.deleted_article = true;
      } catch (error) {
        cleanup.error = error.message;
      }
    }

    return {
      ok: true,
      web_base_url: args.webBaseUrl,
      api_base_url: args.apiBaseUrl,
      email: args.email,
      article_id: articleId,
      processing_banner_observed: processingBannerObserved,
      reader_token_count: tokenCount,
      colored_token: coloredTokenInfo.text,
      clicked_token: tokenInfo.text,
      cleanup,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await run(args);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}

await main();
