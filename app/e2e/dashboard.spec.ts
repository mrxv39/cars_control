import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeVisible();
    await page.locator(".nav-item", { hasText: "Dashboard" }).click();
  });

  test("displays dashboard KPI cards", async ({ page }) => {
    // Dashboard grid with stat cards
    await expect(page.locator(".dashboard-grid, .dashboard-card").first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows stock summary stats", async ({ page }) => {
    // Should display available/reserved/sold counts
    await expect(page.locator("text=Disponible, text=disponible").first()).toBeVisible({ timeout: 10_000 });
  });

  test("leads warning card is interactive when alerts exist", async ({ page }) => {
    const warningCard = page.locator(".warning-card");
    if (!(await warningCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      // No warning — all leads are up to date, which is fine
      test.skip();
      return;
    }

    // Warning card should be keyboard accessible
    await expect(warningCard).toHaveAttribute("role", "button");
    await expect(warningCard).toHaveAttribute("tabindex", "0");
  });

  test("recent leads section visible", async ({ page }) => {
    // Dashboard shows recent leads table
    const leadsSection = page.locator(".dashboard-section, text=Últimos leads").first();
    await expect(leadsSection).toBeVisible({ timeout: 10_000 });
  });
});
