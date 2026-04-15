import { test, expect } from "@playwright/test";

test.describe("Sales Records", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeVisible();
    await page.locator(".nav-item", { hasText: "Ventas" }).click();
  });

  test("displays sales list and stats", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /ventas/i })).toBeVisible();
    // Stats cards should be visible
    await expect(page.locator(".sales-stat-card, .stat-card").first()).toBeVisible({ timeout: 10_000 });
  });

  test("create sale record", async ({ page }) => {
    // Open the form section
    const form = page.locator("form, .sales-form");
    await expect(form).toBeVisible({ timeout: 10_000 });

    // Fill sale fields — vehicle select, price
    const vehicleSelect = page.getByLabel(/vehículo/i);
    if (await vehicleSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Select first available vehicle
      const options = await vehicleSelect.locator("option").all();
      if (options.length > 1) {
        await vehicleSelect.selectOption({ index: 1 });
      }
    }

    await page.getByLabel(/precio/i).fill("15000");

    await page.getByRole("button", { name: /añadir|guardar|registrar/i }).click();

    // New record should appear in the table
    await expect(page.locator("text=15.000, text=15000").first()).toBeVisible({ timeout: 5_000 });
  });

  test("PDF download button exists", async ({ page }) => {
    const pdfBtn = page.getByRole("button", { name: /pdf|descargar/i });
    await expect(pdfBtn).toBeVisible({ timeout: 10_000 });
  });
});
