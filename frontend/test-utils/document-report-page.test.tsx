import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import DocumentReportPage from "@/app/[locale]/(protected)/documents/[id]/report/page";

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "doc-123" }),
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
      <DocumentReportPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mockFetch = jest.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: jest.fn(() => "test-token"),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("DocumentReportPage", () => {
  it("never renders fabricated report data when the request fails", async () => {
    mockFetch.mockResolvedValue(response({ message: "Internal error" }, 500));

    renderPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading|generating/i)).not.toBeInTheDocument(),
    );

    expect(screen.queryByText("Sample Land Title")).not.toBeInTheDocument();
    expect(screen.queryByText("62/100")).not.toBeInTheDocument();
    expect(screen.queryByText("Ownership conflict")).not.toBeInTheDocument();
  });

  it("renders a not-found state on a 404", async () => {
    mockFetch.mockResolvedValue(response({ message: "Not found" }, 404));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Document not found.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Back to documents" })).toBeInTheDocument();
  });

  it("renders an access-denied state on a 403", async () => {
    mockFetch.mockResolvedValue(response({ message: "Forbidden" }, 403));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Access denied")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("You do not have permission to view this document report."),
    ).toBeInTheDocument();
  });

  it("renders the real document when the request succeeds", async () => {
    mockFetch.mockResolvedValue(
      response({
        id: "doc-123",
        title: "Deed of Assignment",
        status: "VERIFIED",
        riskScore: 12,
        riskFlags: [],
      }),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Deed of Assignment")).toBeInTheDocument(),
    );
    expect(screen.getByText("12/100")).toBeInTheDocument();
  });
});
