/**
 * FE-69 — Integration test for the admin documents page.
 *
 * Renders the admin documents page and verifies that the component fetches
 * data through the mocked API layer (no real HTTP calls are made).
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import AdminDocumentsPage from "@/app/[locale]/(protected)/admin/documents/page";

jest.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/admin/documents",
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  getPathname: () => "/admin/documents",
}));

const API_BASE = "http://localhost:3001";

const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  globalThis.fetch = mockFetch;

  // Mock localStorage with a token so auth headers are sent
  const lsMock = {
    getItem: jest.fn((key: string) =>
      key === "auth-token" ? "fake-jwt" : null,
    ),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 1,
    key: jest.fn(() => null),
  };
  Object.defineProperty(window, "localStorage", {
    value: lsMock,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    clone: () => mockJsonResponse(body, status),
  } as unknown as Response;
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdminDocumentsPage />
    </NextIntlClientProvider>,
  );
}

describe("AdminDocumentsPage", () => {
  it("loads and renders documents from the mocked API", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/admin/documents")) {
        return Promise.resolve(
          mockJsonResponse({
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
            page: 1,
            pageSize: 20,
          }),
        );
      }
      return Promise.resolve(mockJsonResponse({}));
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Land Title Alpha")).toBeInTheDocument();
    });

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });
});
