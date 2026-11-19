import { expect, test, type Page, type Route } from "@playwright/test";

const API_BASE = "http://localhost:3001";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const ACCESS_TOKEN = "e2e-2fa-access-token";
const REFRESH_TOKEN = "e2e-2fa-refresh-token";
const TWO_FACTOR_TOKEN = "e2e-two-factor-token";

type ChallengePayload = { twoFactorToken: string; code: string };

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockAuthApi(page: Page) {
  const challenges: ChallengePayload[] = [];
  await page.route(`${API_BASE}/api/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    if (request.method() === "POST" && pathname === "/api/v1/auth/login") {
      await fulfillJson(route, 200, {
        requiresTwoFactor: true,
        twoFactorToken: TWO_FACTOR_TOKEN,
      });
      return;
    }

    if (
      request.method() === "POST" &&
      pathname === "/api/v1/auth/2fa/challenge"
    ) {
      challenges.push(request.postDataJSON() as ChallengePayload);
      await fulfillJson(route, 200, {
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
      });
      return;
    }

    await fulfillJson(route, 404, { message: "Unmocked API request" });
  });
  return challenges;
}

async function readStorage(page: Page, key: string, area: "local" | "session") {
  return page.evaluate(
    ({ key, area }) =>
      area === "local"
        ? window.localStorage.getItem(key)
        : window.sessionStorage.getItem(key),
    { key, area },
  );
}

test.describe("Two-factor login", () => {
  test("completes the challenge and stores the session without exposing the token in the URL", async ({
    page,
  }) => {
    const challenges = await mockAuthApi(page);

    await page.goto("/en/login?redirect=%2Fforgot-password");
    await page.getByLabel("Email address").fill("person@example.com");
    await page.getByLabel("Password", { exact: true }).fill("correct-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/en\/2fa\/verify/);
    expect(page.url()).not.toContain(TWO_FACTOR_TOKEN);
    expect(await readStorage(page, "pending-two-factor-token", "session")).toBe(
      TWO_FACTOR_TOKEN,
    );
    expect(await readStorage(page, "auth-token", "local")).toBeNull();

    await page.getByLabel("6-digit authenticator code").fill("123456");
    await page.getByRole("button", { name: "Verify and continue" }).click();

    await expect.poll(() => challenges).toEqual([
      { twoFactorToken: TWO_FACTOR_TOKEN, code: "123456" },
    ]);
    await expect
      .poll(() => readStorage(page, "auth-token", "local"))
      .toBe(ACCESS_TOKEN);
    expect(await readStorage(page, "refresh-token", "local")).toBe(
      REFRESH_TOKEN,
    );
    expect(await readStorage(page, "pending-two-factor-token", "session")).toBeNull();
    expect(page.url()).not.toContain(TWO_FACTOR_TOKEN);
    await expect(page).toHaveURL(/\/en\/forgot-password/);
  });
});
