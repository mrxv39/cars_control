import { test, expect } from "@playwright/test";

// Public catalog tests don't need authentication
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Public Catalog (codinacars)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // On localhost (mode "both"), catalog is the default unauthenticated view
  });

  test("displays catalog header with brand", async ({ page }) => {
    await expect(page.locator(".catalog-topbar")).toBeVisible();
    await expect(page.locator(".catalog-logo-img")).toBeVisible();
  });

  test("displays vehicle cards grid", async ({ page }) => {
    const cards = page.locator(".catalog-card");
    const emptyState = page.locator("text=No hay vehículos, text=No se encontraron");
    await expect(cards.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test("search filters vehicles", async ({ page }) => {
    const searchInput = page.locator("input[placeholder*='Buscar'], .catalog-search input");
    if (!(await searchInput.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await searchInput.fill("ZZZZNOTEXIST");
    // Should show no results or empty state
    await expect(page.locator(".catalog-card")).toHaveCount(0, { timeout: 5_000 });
  });

  test("click vehicle card opens detail", async ({ page }) => {
    const firstCard = page.locator(".catalog-card").first();
    if (!(await firstCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstCard.click();

    // Detail view: should show vehicle info, gallery, contact section
    await expect(page.locator(".catalog-detail-info, .catalog-back")).toBeVisible({ timeout: 5_000 });
  });

  test("login button redirects to auth", async ({ page }) => {
    const loginBtn = page.locator("button", { hasText: "Acceso usuarios" });
    await expect(loginBtn).toBeVisible();
    // Click should navigate to login page (on localhost) or redirect (on codinacars domain)
    await loginBtn.click();
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible({ timeout: 5_000 });
  });
});
