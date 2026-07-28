import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("homepage redirects to the default locale", async ({ page }) => {
    const response = await page.goto("/");
    // next-intl redirects to /en when localePrefix is 'as-needed' for 'en'
    expect(response?.url()).toContain("/en");
  });

  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/en/login");
    await expect(
      page.getByRole("heading", { name: /sign in/i })
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i })
    ).toBeVisible();
  });

  test("unsupported locale falls back to default", async ({ page }) => {
    const response = await page.goto("/de/login");
    // Should redirect to the English version
    expect(response?.url()).toContain("/en");
  });
});
