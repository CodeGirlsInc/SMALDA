import { http, HttpResponse } from "msw";

const API_BASE = "http://localhost:3001/api/v1";

function createAccessToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: "user-1",
    email: "alice@example.com",
    role: "user",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.signature`;
}

export const handlers = [
  // Auth — login
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === "bad@example.com") {
      return HttpResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }
    return HttpResponse.json({ access_token: createAccessToken() });
  }),

  // Auth — verify
  http.get(`${API_BASE}/auth/verify`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ valid: true });
  }),

  http.get(`${API_BASE}/auth/me`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ id: "user-1", role: "user" });
  }),

  http.get(`${API_BASE}/documents`, () =>
    HttpResponse.json({
      data: [
        {
          id: "doc-1",
          title: "Land Title Alpha",
          status: "verified",
          riskScore: 12,
          riskFlags: [],
          createdAt: "2025-06-01T10:00:00Z",
          updatedAt: "2025-06-01T10:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    }),
  ),

  http.get(`${API_BASE}/disputes`, () =>
    HttpResponse.json({
      data: [
        {
          id: "dispute-1",
          documentId: "doc-1",
          description: "The ownership information is incorrect.",
          reason: { id: "reason-1", name: "Incorrect information" },
          status: "open",
          filedBy: "user-1",
          createdAt: "2025-06-02T10:00:00Z",
        },
      ],
      total: 1,
    }),
  ),

  http.post(`${API_BASE}/disputes`, async ({ request }) => {
    const body = (await request.json()) as {
      documentId: string;
      description: string;
    };
    return HttpResponse.json(
      {
        id: "dispute-2",
        documentId: body.documentId,
        description: body.description,
        reason: null,
        status: "open",
        filedBy: "user-1",
        createdAt: "2025-06-03T10:00:00Z",
      },
      { status: 201 },
    );
  }),

  http.get(`${API_BASE}/disputes/:id`, () =>
    HttpResponse.json({
      id: "dispute-1",
      documentId: "doc-1",
      description: "The ownership information is incorrect.",
      reason: { id: "reason-1", name: "Incorrect information" },
      status: "open",
      filedBy: "user-1",
      createdAt: "2025-06-02T10:00:00Z",
    }),
  ),

  http.patch(`${API_BASE}/disputes/:id/status`, async ({ request }) => {
    const { status } = (await request.json()) as { status: string };
    return HttpResponse.json({
      id: "dispute-1",
      documentId: "doc-1",
      description: "The ownership information is incorrect.",
      reason: { id: "reason-1", name: "Incorrect information" },
      status,
      filedBy: "user-1",
      createdAt: "2025-06-02T10:00:00Z",
    });
  }),

  // Documents — list
  http.get(`${API_BASE}/admin/documents`, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    return HttpResponse.json({
      data: [
        {
          id: "doc-1",
          title: "Land Title Alpha",
          status: "verified",
          riskScore: 0.12,
          riskFlags: [],
          createdAt: "2025-06-01T10:00:00Z",
          owner: {
            id: "user-1",
            email: "alice@example.com",
            fullName: "Alice Smith",
          },
        },
      ],
      total: 1,
      page,
      pageSize: 20,
    });
  }),

  // Documents — export PDF
  http.get(`${API_BASE}/documents/:id/export/pdf`, () => {
    return HttpResponse.arrayBuffer(new ArrayBuffer(0), {
      headers: { "Content-Type": "application/pdf" },
    });
  }),

  // Users — me
  http.get(`${API_BASE}/users/me`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({
      id: "user-1",
      email: "alice@example.com",
      fullName: "Alice Smith",
      preferredLanguage: "en",
    });
  }),

  http.patch(`${API_BASE}/users/me`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ok: true, ...body });
  }),
];
