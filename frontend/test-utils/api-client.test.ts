import {
  ApiError,
  clearSession,
  invalidateRefresh,
  refreshSession,
  request,
  RefreshInvalidatedError,
} from "@/lib/api-client";
import { preserveSessionState } from "@/lib/session-state-preserver";

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

let sessionStore: Record<string, string>;
const sessionStorageMock = {
  getItem: jest.fn((key: string) => sessionStore[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    sessionStore[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete sessionStore[key];
  }),
  get length() {
    return Object.keys(sessionStore).length;
  },
  key: jest.fn((index: number) => Object.keys(sessionStore)[index] ?? null),
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function setTokens(access: string, refresh?: string) {
  lsMock.setItem("auth-token", access);
  if (refresh) lsMock.setItem("refresh-token", refresh);
}

function clearTokens() {
  lsMock.removeItem("auth-token");
  lsMock.removeItem("refresh-token");
}

function makeToken(subject: string): string {
  const payload = btoa(JSON.stringify({ sub: subject }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
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
  sessionStore = {};
  Object.defineProperty(window, "sessionStorage", {
    value: sessionStorageMock,
    writable: true,
    configurable: true,
  });
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.key.mockClear();

  mockFetch = jest.fn();
  globalThis.fetch = mockFetch;

  invalidateRefresh();
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

  it("adopts a refresh completed by another tab", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Rotated" }, { status: 401 }),
    );
    mockFetch.mockResolvedValueOnce(mockResponse({ data: "fresh" }));
    setTokens("expired-jwt", "shared-refresh-token");

    const winner = setTimeout(() => {
      lsMock.setItem("auth-token", "winner-access-token");
      lsMock.setItem("refresh-token", "winner-refresh-token");
    }, 25);

    const data = await request<{ data: string }>("/api/data");
    clearTimeout(winner);

    expect(data).toEqual({ data: "fresh" });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[2][1].headers.get("Authorization")).toBe(
      "Bearer winner-access-token",
    );
    expect(lsMock.getItem("auth-token")).toBe("winner-access-token");
    expect(lsMock.getItem("refresh-token")).toBe("winner-refresh-token");
  });

  it("does not rotate again when another tab already updated storage", async () => {
    mockFetch.mockImplementationOnce(async () => {
      lsMock.setItem("auth-token", "winner-access-token");
      lsMock.setItem("refresh-token", "winner-refresh-token");
      return mockResponse({ message: "Unauthorized" }, { status: 401 });
    });
    mockFetch.mockResolvedValueOnce(mockResponse({ data: "fresh" }));
    setTokens("expired-jwt", "shared-refresh-token");

    const data = await request<{ data: string }>("/api/data");

    expect(data).toEqual({ data: "fresh" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][1].headers.get("Authorization")).toBe(
      "Bearer winner-access-token",
    );
  });

  // ── 401 → refresh failure → clear session + redirect ───────────────────

  it("clears the session when a refreshed request is still unauthorized", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({ access_token: "new-jwt-token" }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );

    setTokens("expired-jwt", "valid-refresh-token");
    await expect(request("/api/secret")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      kind: "authRequired",
    });

    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("refresh-token")).toBeNull();
    expect(locationHref).toContain("/login?redirect=");
  });

  it("clears session and redirects to /login when refresh fails", async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );
    // Refresh call: also fails
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Invalid" }, { status: 401 }),
    );

    setTokens(makeToken("user-a"), "bad-refresh-token");
    const preserved = preserveSessionState("upload-form", { title: "Land deed" });
    expect(preserved.ok).toBe(true);
    if (!preserved.ok) return;
    const resumeId = preserved.value;

    await expect(request("/api/secret")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      kind: "authRequired",
    });

    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("refresh-token")).toBeNull();
    expect(locationHref).toContain("resume=");
    expect(locationHref).toContain(encodeURIComponent(resumeId));
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
    expect(locationHref).toBe("/login?redirect=%2F");
  });

  it("does not clear the session for a transient refresh failure", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unavailable" }, { status: 503 }),
    );
    setTokens("access-token", "refresh-token");

    await expect(request("/api/secret")).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      kind: "server",
    });

    expect(lsMock.getItem("auth-token")).toBe("access-token");
    expect(lsMock.getItem("refresh-token")).toBe("refresh-token");
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

describe("refreshSession()", () => {
  it("uses the canonical refresh endpoint and stores the new access token", async () => {
    setTokens("expired-jwt", "valid-refresh-token");
    mockFetch.mockResolvedValueOnce(
      mockResponse({ access_token: "refreshed-jwt" }),
    );

    await refreshSession();

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/auth/refresh`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(lsMock.getItem("auth-token")).toBe("refreshed-jwt");
  });

  it("rejects asynchronously when no refresh token exists", async () => {
    setTokens("access-token");
    const pending = refreshSession();

    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).rejects.toMatchObject({
      name: "RefreshError",
      status: null,
      definitive: true,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent refreshes", async () => {
    let resolveRefresh!: (value: Response) => void;
    const response = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    mockFetch.mockReturnValue(response);
    setTokens("expired-jwt", "valid-refresh-token");

    const first = refreshSession();
    const second = refreshSession();
    resolveRefresh(mockResponse({ access_token: "refreshed-jwt" }));

    await Promise.all([first, second]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not restore a token after refresh invalidation", async () => {
    let resolveRefresh!: (value: Response) => void;
    const response = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    mockFetch.mockReturnValue(response);
    setTokens("old-access-jwt", "valid-refresh-token");

    const pending = refreshSession();
    await Promise.resolve();
    invalidateRefresh();
    resolveRefresh(mockResponse({ access_token: "stale-jwt" }));

    await expect(pending).rejects.toBeInstanceOf(RefreshInvalidatedError);
    expect(lsMock.getItem("auth-token")).toBe("old-access-jwt");
  });
});

// ── clearSession ────────────────────────────────────────────────────────────

describe("clearSession()", () => {
  it("removes both tokens synchronously and best-effort revokes the server session", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ message: "Logged out" }));
    setTokens("access", "refresh");

    const result = clearSession();

    expect(result.ok).toBe(true);
    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("refresh-token")).toBeNull();

    // The server revocation call fires in the background; flush it.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/auth/logout`,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("still clears local state when the server cannot confirm logout", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unavailable" }, { status: 503 }),
    );
    setTokens("access", "refresh");

    const result = clearSession();

    expect(result.ok).toBe(true);
    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("refresh-token")).toBeNull();
  });

  it("broadcasts a logout-event by default, and skips it when notify is false", () => {
    setTokens("access", "refresh");
    clearSession();
    expect(lsMock.getItem("logout-event")).not.toBeNull();

    setTokens("access", "refresh");
    lsMock.removeItem("logout-event");
    clearSession({ notify: false });
    expect(lsMock.getItem("logout-event")).toBeNull();
  });
});
