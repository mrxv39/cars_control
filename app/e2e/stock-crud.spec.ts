import { test, expect } from "@playwright/test";

test.describe("Stock CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Ensure we're on the stock view (default after login)
    await expect(page.locator(".sidebar")).toBeVisible();
    await page.locator(".nav-item", { hasText: "Stock" }).click();
  });

  test("displays vehicle list", async ({ page }) => {
    // Stock view should show at least the header
    await expect(page.getByRole("heading", { name: /stock/i })).toBeVisible();
    // Should have vehicle rows or empty state
    const rows = page.locator(".stock-row");
    const emptyState = page.locator("text=No hay vehículos");
    await expect(rows.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test("create vehicle via modal", async ({ page }) => {
    const vehicleName = `E2E Test ${Date.now()}`;

    // Open create modal
    await page.getByRole("button", { name: /añadir/i }).click();
    await expect(page.locator(".modal-overlay")).toBeVisible();

    // Fill required fields
    await page.getByLabel(/nombre/i).fill(vehicleName);
    await page.getByLabel(/año/i).fill("2023");
    await page.getByLabel(/precio compra/i).fill("10000");

    // Submit
    await page.getByRole("button", { name: /guardar/i }).click();

    // Modal should close and vehicle should appear in list
    await expect(page.locator(".modal-overlay")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".stock-row", { hasText: vehicleName })).toBeVisible();
  });

  test("open vehicle detail", async ({ page }) => {
    // Click the first vehicle row
    const firstRow = page.locator(".stock-row").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    // Detail view should load
    await expect(page.locator(".breadcrumb")).toBeVisible();
  });

  test("delete vehicle (cleanup)", async ({ page }) => {
    // Find the E2E test vehicle
    const testRow = page.locator(".stock-row", { hasText: "E2E Test" });
    if (!(await testRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await testRow.click();

    // Click delete button in detail view
    const deleteBtn = page.getByRole("button", { name: /eliminar/i });
    await deleteBtn.click();

    // Confirm dialog
    const confirmBtn = page.getByRole("button", { name: /confirmar|sí|eliminar/i });
    await confirmBtn.click();

    // Should return to stock list
    await expect(page.locator(".breadcrumb")).not.toBeVisible({ timeout: 5_000 });
  });
});
