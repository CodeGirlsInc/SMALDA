import { logoutSession } from "@/lib/session";

const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock;
let store: Record<string, string>;

beforeEach(() => {
  store = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: jest.fn((key: string) => store[key] ?? null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
    },
  });
  mockFetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("logoutSession", () => {
  it("calls the versioned backend endpoint and clears local credentials", async () => {
    store["auth-token"] = "access-token";
    store["auth-refresh-token"] = "refresh-token";

    await logoutSession();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: "refresh-token" }),
      }),
    );
    expect(store["auth-token"]).toBeUndefined();
  });
});
