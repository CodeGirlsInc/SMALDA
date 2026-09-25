import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import DocumentsListPage from "@/app/[locale]/(protected)/documents/page";

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DocumentsListPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mockFetch = jest.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: jest.fn((key: string) =>
        key === "auth-token" ? "test-token" : null,
      ),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("DocumentsListPage", () => {
  it("requests the bounded first page and renders the response contract", async () => {
    mockFetch.mockResolvedValue(
      response({
        data: [
          {
            id: "doc-1",
            title: "Land title",
            status: "verified",
            fileSize: 1024,
            createdAt: "2026-07-28T00:00:00.000Z",
          },
        ],
        total: 6,
        page: 1,
        limit: 5,
      }),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText("Land title")).toBeInTheDocument());
    expect(String(mockFetch.mock.calls[0][0])).toContain("/api/v1/documents");
    expect(String(mockFetch.mock.calls[0][0])).toContain("page=1");
    expect(String(mockFetch.mock.calls[0][0])).toContain("limit=5");
    expect(screen.getByRole("navigation", { name: "Document pagination" })).toBeInTheDocument();
  });

  it("requests the next page when the next control is used", async () => {
    mockFetch.mockImplementation((url: string) => {
      const page = Number(new URL(url).searchParams.get("page") ?? "1");
      return Promise.resolve(
        response({
          data: [
            {
              id: page === 1 ? "doc-1" : "doc-6",
              title: page === 1 ? "First page" : "Last page",
              status: "pending",
              createdAt: "2026-07-28T00:00:00.000Z",
            },
          ],
          total: 6,
          page,
          limit: 5,
        }),
      );
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("First page")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(screen.getByText("Last page")).toBeInTheDocument());
    expect(String(mockFetch.mock.calls[1][0])).toContain("page=2");
    expect(String(mockFetch.mock.calls[1][0])).toContain("limit=5");
  });
});
