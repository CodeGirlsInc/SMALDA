import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import AdminActivityPage from "@/app/[locale]/(protected)/admin/activity/page";

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
      <AdminActivityPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
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

describe("AdminActivityPage", () => {
  it("never falls back to fabricated activity when the request fails", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Could not load activity. Please try again.")).toBeInTheDocument(),
    );
    expect(screen.queryByText("admin@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("User login")).not.toBeInTheDocument();
  });

  it("shows an access-denied state on a 403", async () => {
    mockFetch.mockResolvedValue(response({}, 403));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Admin access required")).toBeInTheDocument(),
    );
  });

  it("renders real activity when the request succeeds", async () => {
    mockFetch.mockResolvedValue(
      response({
        data: [
          {
            id: "a1",
            userId: "u1",
            user_email: "real.user@example.com",
            actionType: "login",
            action: "User login",
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("real.user@example.com")).toBeInTheDocument(),
    );
  });
});
