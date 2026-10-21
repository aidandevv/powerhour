import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const databaseUrl =
  process.env.PLAYWRIGHT_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  "postgresql://finance_app:finance_app@127.0.0.1:5432/powerhour_test";
const modelPort = Number(process.env.MODEL_TEST_PORT ?? 11436);
const modelBaseURL = process.env.PLAYWRIGHT_AI_BASE_URL ?? `http://127.0.0.1:${modelPort}/v1`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["junit", { outputFile: "test-results/playwright.junit.xml" }], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [{
        command: "node e2e/fixtures/model-server.mjs",
        url: `http://127.0.0.1:${modelPort}/health`,
        reuseExistingServer: false,
        env: { MODEL_TEST_PORT: String(modelPort) },
      }, {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          DATABASE_URL: databaseUrl,
          DATABASE_SSL: "disable",
          DEMO_MODE: "true",
          NEXT_PUBLIC_DEMO_MODE: "true",
          ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000",
          SESSION_SECRET:
            "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
          DASHBOARD_PASSWORD_HASH: "ci-password-hash",
          GEMINI_API_KEY: "test-key",
          AI_PROVIDER: "openai-compatible",
          AI_BASE_URL: modelBaseURL,
          AI_MODEL: process.env.PLAYWRIGHT_AI_MODEL ?? "smoke-chat",
          AI_MODEL_CHAT: process.env.PLAYWRIGHT_AI_MODEL ?? "smoke-chat",
          AI_MODEL_PLANNER: process.env.PLAYWRIGHT_AI_MODEL ?? "smoke-planner",
          AI_MODEL_REPORT: process.env.PLAYWRIGHT_AI_MODEL ?? "smoke-report",
          AI_MODEL_GOALS: process.env.PLAYWRIGHT_AI_MODEL ?? "smoke-goals",
          AI_MODEL_DIGEST: process.env.PLAYWRIGHT_AI_MODEL ?? "smoke-digest",
          AI_CHAT_TIMEOUT_MS: "300000",
          AI_PLANNER_TIMEOUT_MS: "300000",
          AI_REPORT_TIMEOUT_MS: "180000",
          AI_GOALS_TIMEOUT_MS: "180000",
          NEXT_PUBLIC_APP_URL: baseURL,
        },
      }],
});
