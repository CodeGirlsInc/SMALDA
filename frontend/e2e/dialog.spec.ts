import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("protected dashboard redirects unauthenticated users to login", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.url()).toContain("/login");
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
