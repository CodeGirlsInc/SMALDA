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

const originalFetch = globalThis.fetch;

function encodeJwtPart(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createJwt(
  expiresAt = Math.floor(Date.now() / 1000) + 3600,
): string {
  const header = encodeJwtPart({ alg: "HS256", typ: "JWT" });
  const payload = encodeJwtPart({
    sub: "user-1",
    email: "user@example.com",
    role: "user",
    exp: expiresAt,
  });
  return `${header}.${payload}.signature`;
}

beforeEach(() => {
  jest.resetModules();
  localStorageMock.clear();
  store["auth-refresh-token"] = createJwt();
  store["auth-token"] = createJwt(Math.floor(Date.now() / 1000) - 1);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("concurrent proactive refresh", () => {
  it("uses one refresh for ten requests with expired access tokens", async () => {
    let apiClient: typeof import("../api-client");
    await jest.isolateModulesAsync(async () => {
      apiClient = await import("../api-client");
    });

    let refreshCallCount = 0;
    globalThis.fetch = jest.fn((url: string) => {
      if (url.includes("/api/v1/auth/refresh")) {
        refreshCallCount += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ access_token: createJwt() }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    }) as jest.Mock;

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        apiClient!.request(`documents/${index}`),
      ),
    );

    expect(refreshCallCount).toBe(1);
  });

  it("clears storage and redirects when proactive refresh fails", async () => {
    let apiClient: typeof import("../api-client");
    await jest.isolateModulesAsync(async () => {
      apiClient = await import("../api-client");
    });

    let redirect = "";
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/dashboard",
        search: "",
        get href() {
          return redirect;
        },
        set href(value: string) {
          redirect = value;
        },
      },
      configurable: true,
    });
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 401,
        }),
      ),
    ) as jest.Mock;

    await expect(
      apiClient!.request("documents/1"),
    ).rejects.toMatchObject({
      status: 401,
      kind: "authRequired",
    });
    expect(store["auth-token"]).toBeUndefined();
    expect(store["auth-refresh-token"]).toBeUndefined();
    expect(redirect).toContain("/login?redirect=");
  });
});
