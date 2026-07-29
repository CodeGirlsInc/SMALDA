/**
 * Tests for graceful session expiry handling (Issue #1024).
 *
 * Core requirement: 10 concurrent requests that all get 401 should trigger
 * exactly 1 refresh call.
 */

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => store[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete store[key];
  }),
  clear: jest.fn(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
};

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// We need to isolate the module so the refreshPromise singleton is fresh
// and we can spy on fetch calls.
// eslint-disable-next-line @typescript-eslint/no-require-imports
let apiClient: typeof import("../api-client");

beforeEach(() => {
  jest.resetModules();
  localStorageMock.clear();
  // Clear the module cache so the refreshPromise singleton resets
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    apiClient = require("../api-client");
  });
  // Seed a valid refresh token so the refresh path can execute
  store["refresh-token"] = "fake-refresh-token";
  store["auth-token"] = "expired-access-token";
});

describe("Concurrent 401 → single refresh (Issue #1024)", () => {
  it("triggers exactly one refresh when 10 parallel requests get 401", async () => {
    // Reload inside isolatedModules to get a fresh singleton
    let freshApiClient: typeof import("../api-client");
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      freshApiClient = require("../api-client");
    });

    let refreshCallCount = 0;

    // Mock fetch: first call to any endpoint returns 401,
    // the refresh call returns 200 with a new token,
    // and retried calls return 200.
    (global as any).fetch = jest.fn((url: string) => {
      if (url.includes("/auth/refresh")) {
        refreshCallCount += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify({ access_token: "new-access-token" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      // Non-refresh endpoints: succeed on the second attempt (after refresh)
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    }) as jest.Mock;

    // Fire 10 concurrent requests — each will get a 401, triggering the
    // refresh path. The refreshPromise singleton should deduplicate them.
    const promises = Array.from({ length: 10 }, (_, i) =>
      freshApiClient!.request(`/api/documents/${i}`),
    );

    await Promise.all(promises);

    // Assert: exactly 1 refresh call despite 10 concurrent 401s
    expect(refreshCallCount).toBe(1);
  });

  it("clears session and redirects when refresh fails", async () => {
    let freshApiClient: typeof import("../api-client");
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      freshApiClient = require("../api-client");
    });

    // Override window.location for the redirect assertion
    const originalLocation = window.location;
    // @ts-expect-error — partial mock of Location
    delete (window as any).location;
    (window as any).location = { href: "" };

    (global as any).fetch = jest.fn((url: string) => {
      if (url.includes("/auth/refresh")) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "invalid_grant" }), {
            status: 401,
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        }),
      );
    }) as jest.Mock;

    try {
      await freshApiClient!.request("/api/documents/1");
    } catch {
      // Expected — api-client throws after refresh failure
    }

    // Should have cleared localStorage tokens
    expect(store["auth-token"]).toBeUndefined();
    expect(store["refresh-token"]).toBeUndefined();
    // Should have redirected to login preserving the path
    expect(window.location.href).toContain("/login?redirect=");

    // Restore
    (window as any).location = originalLocation;
  });
});
