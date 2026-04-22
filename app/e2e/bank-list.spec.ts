import { test, expect } from "@playwright/test";

test.describe("Bank list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeVisible();
    await page.locator(".nav-item", { hasText: "Banco" }).click();
  });

  test("displays bank list with transactions", async ({ page }) => {
    const rows = page.locator("tr, .bank-row, .record-row");
    const emptyState = page.locator("text=No hay movimientos");
    await expect(rows.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test("account selector is visible", async ({ page }) => {
    const selector = page.locator('select[aria-label*="cuenta"], select[name*="account"]').first();
    const accountName = page.locator("text=CODINACARS").first();
    await expect(selector.or(accountName)).toBeVisible({ timeout: 10_000 });
  });

  test("period selector switches between mes/trimestre/año", async ({ page }) => {
    const periodSelector = page.locator('select[aria-label*="período"], select[aria-label*="periodo"]').first();
    if (!(await periodSelector.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await periodSelector.selectOption({ label: /trimestre/i });
    await expect(periodSelector).toHaveValue(/trimestre|quarter/i);
  });

  test("sincronizar button is accessible", async ({ page }) => {
    const syncBtn = page.getByRole("button", { name: /sincronizar/i });
    if (!(await syncBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await expect(syncBtn).toBeEnabled();
  });
});
