import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminAuditLogsPage from "@/app/(protected)/admin/audit-logs/page";

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: jest.fn(() => "admin-token"),
    },
  });
  global.fetch = mockFetch as unknown as typeof fetch;
});

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}

function renderPage() {
  return render(<AdminAuditLogsPage />);
}

describe("AdminAuditLogsPage", () => {
  it("requests at most 20 records and renders only the returned page", async () => {
    mockFetch.mockResolvedValue(
      response({
        data: Array.from({ length: 20 }, (_, index) => ({
          id: `log-${index}`,
          routePath: `/api/documents/${index}`,
          httpMethod: "GET",
          ipAddress: "192.0.2.1",
          statusCode: 200,
          createdAt: "2026-08-26T12:00:00.000Z",
        })),
        total: 41,
        page: 1,
        limit: 20,
        totalPages: 3,
      }),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText("/api/documents/19")).toBeInTheDocument());
    expect(screen.queryByText("/api/documents/20")).not.toBeInTheDocument();
    expect(String(mockFetch.mock.calls[0][0])).toContain("page=1");
    expect(String(mockFetch.mock.calls[0][0])).toContain("limit=20");
    expect(screen.getByRole("navigation", { name: "Audit log pagination" })).toBeInTheDocument();
  });

  it("requests the next bounded page when pagination advances", async () => {
    mockFetch
      .mockResolvedValueOnce(
        response({
          data: [{
            id: "log-1",
            routePath: "/first-page",
            httpMethod: "GET",
            ipAddress: "192.0.2.1",
            statusCode: 200,
            createdAt: "2026-08-26T12:00:00.000Z",
          }],
          total: 21,
          page: 1,
          limit: 20,
          totalPages: 2,
        }),
      )
      .mockResolvedValueOnce(
        response({
          data: [{
            id: "log-21",
            routePath: "/second-page",
            httpMethod: "POST",
            ipAddress: "192.0.2.2",
            statusCode: 201,
            createdAt: "2026-08-26T12:01:00.000Z",
          }],
          total: 21,
          page: 2,
          limit: 20,
          totalPages: 2,
        }),
      );

    renderPage();
    await waitFor(() => expect(screen.getByText("/first-page")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByText("/second-page")).toBeInTheDocument());

    expect(String(mockFetch.mock.calls[1][0])).toContain("page=2");
    expect(String(mockFetch.mock.calls[1][0])).toContain("limit=20");
  });
});
