import { NextRequest } from "next/server";
import middleware, { isProtectedPath } from "@/middleware";

jest.mock("next-intl/middleware", () => ({
  __esModule: true,
  default: jest.fn(() => {
    const { NextResponse: response } = require("next/server");
    return response.next();
  }),
}));

const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock;

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("protected route middleware", () => {
  it("recognizes the dashboard root, 2FA setup, and protected route groups", () => {
    expect(isProtectedPath("/")).toBe(true);
    expect(isProtectedPath("/fr")).toBe(true);
    expect(isProtectedPath("/2fa/setup")).toBe(true);
    expect(isProtectedPath("/fr/2fa/setup")).toBe(true);
    expect(isProtectedPath("/settings/security")).toBe(true);
    expect(isProtectedPath("/fr/documents/abc")).toBe(true);
    expect(isProtectedPath("/document/legacy-id")).toBe(true);
    expect(isProtectedPath("/documents/file.pdf")).toBe(true);
    expect(isProtectedPath("/map")).toBe(true);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/2fa/verify")).toBe(false);
    expect(isProtectedPath("/auth/refresh")).toBe(false);
    expect(isProtectedPath("/auth/oauth/callback")).toBe(false);
    expect(isProtectedPath("/fr/register")).toBe(false);
    expect(isProtectedPath("/dashboard")).toBe(false);
    expect(isProtectedPath("/verify/hash")).toBe(false);
  });

  it("redirects a missing cookie without calling the verifier", async () => {
    const result = await middleware(
      new NextRequest("https://smalda.test/fr/settings?tab=security"),
    );
    const redirectUrl = new URL(result.headers.get("location")!);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(redirectUrl.pathname).toBe("/fr/login");
    expect(redirectUrl.searchParams.get("redirect")).toBe(
      "/fr/settings?tab=security",
    );
  });

  it("routes an expired access cookie through client refresh when a refresh cookie exists", async () => {
    fetchMock.mockResolvedValue(response(401));
    const result = await middleware(
      new NextRequest("https://smalda.test/fr/settings?tab=security", {
        headers: {
          cookie: "access_token=expired; refresh_token=refresh",
        },
      }),
    );
    const redirectUrl = new URL(result.headers.get("location")!);

    expect(result.status).toBe(307);
    expect(redirectUrl.pathname).toBe("/fr/auth/refresh");
    expect(redirectUrl.searchParams.get("redirect")).toBe(
      "/fr/settings?tab=security",
    );
  });

  it("routes a missing access cookie through refresh when only the refresh cookie exists", async () => {
    const result = await middleware(
      new NextRequest("https://smalda.test/settings", {
        headers: { cookie: "refresh_token=refresh" },
      }),
    );
    const redirectUrl = new URL(result.headers.get("location")!);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(redirectUrl.pathname).toBe("/auth/refresh");
    expect(redirectUrl.searchParams.get("redirect")).toBe("/settings");
  });

  it("delegates cookie authentication to the backend verifier", async () => {
    fetchMock.mockResolvedValue(response(200));
    const result = await middleware(
      new NextRequest("https://smalda.test/settings", {
        headers: { cookie: "access_token=opaque-value" },
      }),
    );

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/me"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer opaque-value",
        }),
      }),
    );
  });

  it("redirects only for definite verifier rejection", async () => {
    fetchMock.mockResolvedValue(response(401));
    const result = await middleware(
      new NextRequest("https://smalda.test/settings", {
        headers: { cookie: "access_token=invalid-value" },
      }),
    );

    expect(result.status).toBe(307);
    expect(new URL(result.headers.get("location")!).pathname).toBe("/login");
  });

  it("fails closed without redirecting on verifier failure", async () => {
    fetchMock.mockResolvedValue(response(503));
    const result = await middleware(
      new NextRequest("https://smalda.test/settings", {
        headers: { cookie: "access_token=opaque-value" },
      }),
    );

    expect(result.status).toBe(503);
    expect(result.headers.get("location")).toBeNull();
  });

  it("does not invoke locale middleware for infrastructure or static assets", async () => {
    await middleware(new NextRequest("https://smalda.test/api/documents"));
    await middleware(new NextRequest("https://smalda.test/fr/logo.svg"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes unsupported public locales before localization", async () => {
    const result = await middleware(
      new NextRequest("https://smalda.test/de/login?from=callback"),
    );
    const redirectUrl = new URL(result.headers.get("location")!);

    expect(redirectUrl.pathname).toBe("/en/login");
    expect(redirectUrl.searchParams.get("from")).toBe("callback");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
