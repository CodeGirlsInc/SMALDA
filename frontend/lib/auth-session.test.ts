import {
  clearSession,
  getJwtExpiration,
  getValidAccessToken,
  getValidRefreshToken,
  hasStoredSession,
  resolvePostLoginPath,
  storeSession,
} from "./auth-session";

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

function encodeJwtPart(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createJwt(
  expiresAt = Math.floor(Date.now() / 1000) + 3600,
): string {
  return `${encodeJwtPart({ alg: "HS256", typ: "JWT" })}.${encodeJwtPart({
    sub: "user-1",
    email: "user@example.com",
    role: "user",
    exp: expiresAt,
  })}.signature`;
}

beforeEach(() => {
  Object.keys(store).forEach((key) => delete store[key]);
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
});

describe("auth-session", () => {
  it("stores and returns current backend-shaped JWTs", () => {
    const accessToken = createJwt();
    const refreshToken = createJwt();

    expect(
      storeSession({ access_token: accessToken, refresh_token: refreshToken }),
    ).toBe(true);
    expect(getValidAccessToken()).toBe(accessToken);
    expect(getValidRefreshToken()).toBe(refreshToken);
    expect(getJwtExpiration(accessToken)).toBeGreaterThan(Date.now() / 1000);
    expect(hasStoredSession()).toBe(true);
  });

  it("fails closed for expired and malformed access tokens", () => {
    store["auth-token"] = createJwt(Math.floor(Date.now() / 1000) - 1);
    expect(getValidAccessToken()).toBeNull();

    store["auth-token"] = "not-a-jwt";
    expect(getValidAccessToken()).toBeNull();
    expect(getJwtExpiration("not-a-jwt")).toBeNull();
  });

  it("removes a stale refresh token when the response has none", () => {
    store["auth-refresh-token"] = createJwt();

    expect(storeSession({ access_token: createJwt() })).toBe(true);
    expect(getValidRefreshToken()).toBeNull();
  });

  it("does not fall back from a malformed canonical refresh token", () => {
    store["auth-refresh-token"] = "malformed";
    store["refresh-token"] = createJwt();
    expect(getValidRefreshToken()).toBeNull();
  });

  it("rejects an expired session instead of partially storing it", () => {
    expect(
      storeSession({
        access_token: createJwt(Math.floor(Date.now() / 1000) - 1),
        refresh_token: createJwt(),
      }),
    ).toBe(false);
    expect(hasStoredSession()).toBe(false);
  });

  it("strips the active locale before locale-aware navigation", () => {
    expect(resolvePostLoginPath("/fr/settings/security", "fr")).toBe(
      "/settings/security",
    );
    expect(resolvePostLoginPath("/fr?next=1", "fr")).toBe("/?next=1");
    expect(resolvePostLoginPath("/fr//evil.example", "fr")).toBe("/");
    expect(resolvePostLoginPath("/fr/\\evil.example", "fr")).toBe("/");
    expect(resolvePostLoginPath(null, "fr")).toBe("/");
  });

  it("handles unavailable browser storage without throwing", () => {
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(() => {
          throw new Error("blocked");
        }),
        setItem: jest.fn(() => {
          throw new Error("blocked");
        }),
        removeItem: jest.fn(() => {
          throw new Error("blocked");
        }),
      },
      configurable: true,
    });

    expect(getValidAccessToken()).toBeNull();
    expect(storeSession({ access_token: createJwt() })).toBe(false);
    expect(() => clearSession()).not.toThrow();
  });
});
