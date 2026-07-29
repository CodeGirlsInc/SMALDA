import { ApiError, clearSession, request } from "@/lib/api-client";

const API_BASE = "http://localhost:3001";

// ── localStorage mock ───────────────────────────────────────────────────────

let store: Record<string, string>;

function createLocalStorageMock() {
  store = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      for (const k of Object.keys(store)) delete store[k];
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn(() => null),
  };
}

let lsMock: ReturnType<typeof createLocalStorageMock>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function setTokens(access: string, refresh?: string) {
  lsMock.setItem("auth-token", access);
  if (refresh) lsMock.setItem("refresh-token", refresh);
}

function clearTokens() {
  lsMock.removeItem("auth-token");
  lsMock.removeItem("refresh-token");
}

/** Build a mock Response-like object */
function mockResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new Blob()),
    clone: () => mockResponse(body, init),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: "basic" as ResponseType,
    url: "",
    bytes: () => Promise.resolve(new Uint8Array()),
  } as unknown as Response;
}

// ── Fetch mock ──────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock;

// ── Location mock ───────────────────────────────────────────────────────────

let locationHref = "";

beforeEach(() => {
  lsMock = createLocalStorageMock();
  // jsdom's localStorage is a non-functional stub; replace it entirely
  // Use direct assignment since the property is configurable in jsdom
  try {
    Object.defineProperty(window, "localStorage", {
      value: lsMock,
      writable: true,
      configurable: true,
    });
  } catch {
    // Fallback: some jsdom versions use a getter
    (window as any).localStorage = lsMock;
  }

  clearTokens();

  mockFetch = jest.fn();
  globalThis.fetch = mockFetch;

  // Prevent actual navigation on redirect
  locationHref = "";
  Object.defineProperty(window, "location", {
    value: {
      get href() {
        return locationHref;
      },
      set href(v: string) {
        locationHref = v;
      },
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("request()", () => {
  // ── Success path ────────────────────────────────────────────────────────

  it("attaches JWT and returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));

    setTokens("my-jwt-token");
    const data = await request<{ ok: boolean }>("/api/test");

    expect(data).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/test`);
    expect(opts.headers.get("Authorization")).toBe("Bearer my-jwt-token");
  });

  it("sends no Authorization header when anonymous is true", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ public: true }));

    setTokens("should-not-be-sent");
    const data = await request<{ public: boolean }>("/api/public", {
      anonymous: true,
    });

    expect(data).toEqual({ public: true });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.get("Authorization")).toBeNull();
  });

  it("throws ApiError with backend message on non-2xx", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Something broke" }, { status: 422 }),
    );

    setTokens("token");

    await expect(request("/api/fail")).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      kind: "validation",
      backendMessage: "Something broke",
    });
  });

  it("throws ApiError with network kind on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    setTokens("token");

    await expect(request("/api/network-fail")).rejects.toMatchObject({
      name: "ApiError",
      status: null,
      kind: "network",
    });
  });

  it("returns undefined for 204 No Content", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 204 }));

    setTokens("token");
    const result = await request("/api/resource/1", { method: "DELETE" });
    expect(result).toBeUndefined();
  });

  it("serializes plain-object bodies to JSON", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ id: "1" }));

    setTokens("token");
    await request("/api/data", {
      method: "POST",
      body: { title: "Test" },
    });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBe(JSON.stringify({ title: "Test" }));
    expect(opts.headers.get("Content-Type")).toBe("application/json");
  });

  // ── 401 → refresh success → retry success ──────────────────────────────

  it("refreshes token on 401 and retries the original request", async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );
    // Refresh call: success
    mockFetch.mockResolvedValueOnce(
      mockResponse({ access_token: "new-jwt-token" }),
    );
    // Retry call: success
    mockFetch.mockResolvedValueOnce(mockResponse({ data: "fresh" }));

    setTokens("expired-jwt", "valid-refresh-token");
    const data = await request<{ data: string }>("/api/data");

    expect(data).toEqual({ data: "fresh" });
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // First call had old token
    expect(mockFetch.mock.calls[0][1].headers.get("Authorization")).toBe(
      "Bearer expired-jwt",
    );
    // Retry had new token
    expect(mockFetch.mock.calls[2][1].headers.get("Authorization")).toBe(
      "Bearer new-jwt-token",
    );
    // Token was updated in storage
    expect(lsMock.getItem("auth-token")).toBe("new-jwt-token");
  });

  // ── 401 → refresh failure → clear session + redirect ───────────────────

  it("clears session and redirects to /login when refresh fails", async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );
    // Refresh call: also fails
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Invalid" }, { status: 401 }),
    );

    setTokens("expired-token", "bad-refresh-token");

    await expect(request("/api/secret")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      kind: "authRequired",
    });

    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("refresh-token")).toBeNull();
    expect(locationHref).toBe("/login");
  });

  it("clears session and redirects when no refresh token exists", async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );

    setTokens("expired-token"); // no refresh token

    await expect(request("/api/secret")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      kind: "authRequired",
    });

    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(locationHref).toBe("/login");
  });

  it("does not attempt refresh for anonymous requests", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );

    await expect(
      request("/api/public", { anonymous: true }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      kind: "authRequired",
    });

    // Only one fetch call — no refresh attempt
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ── clearSession ────────────────────────────────────────────────────────────

describe("clearSession()", () => {
  it("removes both tokens from localStorage", () => {
    setTokens("access", "refresh");
    clearSession();
    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("refresh-token")).toBeNull();
  });
});
