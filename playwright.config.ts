import { defineConfig } from "@playwright/test";

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8001";
const webBaseUrl = process.env.PLAYWRIGHT_WEB_BASE_URL ?? "http://127.0.0.1:3101";
const apiPort = new URL(apiBaseUrl).port || "8001";
const webPort = new URL(webBaseUrl).port || "3101";

export default defineConfig({
  testDir: "apps/web/e2e",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: webBaseUrl,
    headless: true,
  },
  webServer: [
    {
      command: `PLAYWRIGHT_API_PORT=${apiPort} PLAYWRIGHT_WEB_PORT=${webPort} bash scripts/run_playwright_api.sh`,
      url: `${apiBaseUrl}/health`,
      timeout: 180_000,
      reuseExistingServer: true,
    },
    {
      command: `NEXT_DIST_DIR=.next-playwright npm run dev --workspace @yomuyomu/web -- --hostname 127.0.0.1 --port ${webPort}`,
      url: `${webBaseUrl}/login`,
      timeout: 180_000,
      reuseExistingServer: true,
      env: {
        NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
        NEXT_DIST_DIR: ".next-playwright",
        PLAYWRIGHT_API_BASE_URL: apiBaseUrl,
      },
    },
  ],
});
