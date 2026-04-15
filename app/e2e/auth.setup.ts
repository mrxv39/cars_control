import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth", "user.json");

/**
 * Authenticate once and save storageState for all other tests.
 * Requires env vars: E2E_USER, E2E_PASSWORD
 */
setup("authenticate", async ({ page }) => {
  const user = process.env.E2E_USER;
  const pass = process.env.E2E_PASSWORD;
  if (!user || !pass) {
    throw new Error("E2E_USER and E2E_PASSWORD env vars are required for E2E tests");
  }

  await page.goto("/");

  // On localhost (mode "both"), the app may show catalog first — click login
  const loginBtn = page.locator("button", { hasText: "Acceso usuarios" });
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginBtn.click();
  }

  // Fill login form
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await page.getByLabel("Usuario").fill(user);
  await page.getByLabel("Contraseña").fill(pass);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Wait for authenticated app to load (sidebar with nav items)
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15_000 });

  // Save auth state
  await page.context().storageState({ path: authFile });
});
