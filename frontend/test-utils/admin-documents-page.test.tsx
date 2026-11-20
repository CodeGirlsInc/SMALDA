import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import AdminDocumentsPage from "@/app/[locale]/(protected)/admin/documents/page";

const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/admin/documents",
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
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
      <AdminDocumentsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParams = new URLSearchParams();
  mockFetch = jest.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: jest.fn(() => "admin-token"),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("AdminDocumentsPage", () => {
  it("initializes filters from the URL query string so views are shareable", async () => {
    mockSearchParams = new URLSearchParams({ status: "flagged", ownerEmail: "a@b.com" });
    mockFetch.mockResolvedValue(response({ data: [], total: 0, page: 1, pageSize: 20 }));

    renderPage();

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain("status=flagged");
    expect(calledUrl).toContain("ownerEmail=a%40b.com");
  });

  it("pushes applied filters into the URL query string", async () => {
    mockFetch.mockResolvedValue(response({ data: [], total: 0, page: 1, pageSize: 20 }));

    renderPage();
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Owner email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0];
    expect(String(lastCall)).toContain("ownerEmail=owner%40example.com");
  });
});
