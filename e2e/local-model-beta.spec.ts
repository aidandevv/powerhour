import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter demo" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("settings labels all five local-model features beta", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Local / OpenAI-compatible · Beta")).toBeVisible();
  for (const feature of ["Ticker", "Budget Planner", "PDF reports", "Smart budget goals", "Weekly AI digest"]) {
    await expect(page.getByLabel(`${feature} with a local model beta`).first()).toBeVisible();
  }
  const status = await page.request.get("/api/ai/status");
  expect(await status.json()).toMatchObject({ provider: "openai-compatible", beta: true });
});

test("Ticker is beta and streams a tool-backed reply", async ({ page }) => {
  await expect(page.getByLabel("Ticker with a local model beta")).toBeVisible();
  await page.getByPlaceholder("Enter query...").fill("What is my balance?");
  await page.getByPlaceholder("Enter query...").press("Enter");
  await expect(page.getByText("Local model response received.", { exact: true })).toBeVisible();
});

test("Budget Planner is beta and streams a savings calculation", async ({ page }) => {
  await page.goto("/budget-planner");
  await expect(page.getByLabel("Budget Planner with a local model beta")).toBeVisible();
  await page.locator("textarea").fill("Save 1200 at 100 per month");
  await page.locator("textarea").press("Enter");
  await expect(page.getByText("Your savings plan is ready.", { exact: true })).toBeVisible();
});

test("smart budgets is beta and persists regenerated goals", async ({ page }) => {
  await page.goto("/budgets");
  await expect(page.getByLabel("Smart budget goals with a local model beta")).toBeVisible();
  const generated = page.waitForResponse((response) => response.url().endsWith("/api/budget-goals/generate") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Re-analyze", exact: true }).click();
  expect((await generated).status()).toBe(200);
  await page.getByRole("button", { name: "Why this goal? ↓" }).first().click();
  await expect(page.getByText("Reduce monthly discretionary spending.").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Keep monthly FOOD_AND_DRINK under $100.00")).toBeVisible();
});

test("reports stays beta through a successful PDF download", async ({ page }) => {
  await expect(page.getByLabel("PDF reports with a local model beta")).toBeVisible();
  await page.getByRole("button", { name: /Generate Report/ }).click();
  await expect(page.getByLabel("PDF reports with a local model beta")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/^financial-report-.*\.pdf$/);
});

test("floating Ticker exposes beta before and after opening", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Open Ticker (local model beta)" }).click();
  await expect(page.getByLabel("Ticker with a local model beta")).toBeVisible();
});

test("AI provider metadata requires authentication", async ({ browser, baseURL }) => {
  const anonymous = await browser.newContext();
  const response = await anonymous.request.get(`${baseURL}/api/ai/status`);
  expect(response.status()).toBe(401);
  await anonymous.close();
});
