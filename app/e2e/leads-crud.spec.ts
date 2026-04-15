import { test, expect } from "@playwright/test";

test.describe("Leads CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeVisible();
    await page.locator(".nav-item", { hasText: "Leads" }).click();
  });

  test("displays leads list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /leads/i })).toBeVisible();
    const rows = page.locator("tr, .lead-row, .record-row");
    const emptyState = page.locator("text=No hay leads");
    await expect(rows.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test("create lead via modal", async ({ page }) => {
    const leadName = `E2E Lead ${Date.now()}`;

    await page.getByRole("button", { name: /añadir/i }).click();
    await expect(page.locator(".modal-overlay")).toBeVisible();

    await page.getByLabel(/nombre/i).fill(leadName);
    await page.getByLabel(/teléfono/i).fill("600123456");
    await page.getByLabel(/canal/i).selectOption("llamada");

    await page.getByRole("button", { name: /guardar/i }).click();
    await expect(page.locator(".modal-overlay")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=" + leadName)).toBeVisible();
  });

  test("edit lead status", async ({ page }) => {
    // Find any lead with status "nuevo" and change it
    const leadRow = page.locator("text=E2E Lead").first();
    if (!(await leadRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Click edit button on the lead row
    await leadRow.locator("..").getByRole("button", { name: /editar/i }).click();
    await expect(page.locator(".modal-overlay")).toBeVisible();

    // Change status
    await page.getByLabel(/estado/i).selectOption("contactado");
    await page.getByRole("button", { name: /guardar/i }).click();
    await expect(page.locator(".modal-overlay")).not.toBeVisible({ timeout: 5_000 });
  });

  test("delete lead (cleanup)", async ({ page }) => {
    const leadRow = page.locator("text=E2E Lead").first();
    if (!(await leadRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await leadRow.locator("..").getByRole("button", { name: /eliminar/i }).click();

    // Confirm dialog
    const confirmBtn = page.getByRole("button", { name: /confirmar|sí|eliminar/i });
    await confirmBtn.click();

    // Lead should disappear
    await expect(leadRow).not.toBeVisible({ timeout: 5_000 });
  });
});
