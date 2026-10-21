import { expect, test } from "@playwright/test";

test.describe("demo smoke", () => {
  test("enters the deterministic demo and renders the dashboard", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "powerhour" })).toBeVisible();
    await page.getByRole("button", { name: "Enter demo" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Demo mode — data is simulated. Plaid linking and syncing are disabled.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
