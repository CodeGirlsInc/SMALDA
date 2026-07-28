import { http, HttpResponse } from "msw";

const API_BASE = "http://localhost:3001";

export const handlers = [
  // Auth — login
  http.post(`${API_BASE}/api/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === "bad@example.com") {
      return HttpResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }
    return HttpResponse.json({ token: "fake-jwt-token" });
  }),

  // Auth — verify
  http.get(`${API_BASE}/api/auth/verify`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ valid: true });
  }),

  // Documents — list
  http.get(`${API_BASE}/api/admin/documents`, ({ request }) => {
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
  http.get(`${API_BASE}/api/documents/:id/export/pdf`, () => {
    return HttpResponse.arrayBuffer(new ArrayBuffer(0), {
      headers: { "Content-Type": "application/pdf" },
    });
  }),

  // Users — me
  http.get(`${API_BASE}/api/users/me`, ({ request }) => {
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

  http.patch(`${API_BASE}/api/users/me`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ok: true, ...body });
  }),
];
