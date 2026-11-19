import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportsPage from "@/app/[locale]/(protected)/reports/page";

const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock;

function response(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob([JSON.stringify(body)])),
    headers: {
      get: (name: string) => headers?.[name] ?? null,
    },
  } as unknown as Response;
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
  URL.createObjectURL = jest.fn(() => "blob:mock-url");
  URL.revokeObjectURL = jest.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ReportsPage export buttons", () => {
  it("calls the versioned, credentialed excel export endpoint and shows a clear error instead of a silent fallback", async () => {
    mockFetch.mockResolvedValue(response([]));
    render(<ReportsPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    mockFetch.mockResolvedValueOnce(response({ message: "not implemented" }, 404));

    fireEvent.click(screen.getByRole("button", { name: /download as excel/i }));

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    // Must never silently "succeed" with a fabricated file.
    expect(URL.createObjectURL).not.toHaveBeenCalled();

    const call = mockFetch.mock.calls.find((c) =>
      String(c[0]).includes("/documents/export/excel"),
    );
    expect(call).toBeDefined();
    expect(String(call?.[0])).toContain("/api/v1/documents/export/excel");
    expect((call?.[1] as RequestInit)?.credentials).toBe("include");
  });

  it("calls the versioned, credentialed PDF export endpoint and shows a clear error instead of a fake PDF", async () => {
    mockFetch.mockResolvedValue(response([]));
    render(<ReportsPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    mockFetch.mockResolvedValueOnce(response({ message: "not implemented" }, 404));

    fireEvent.click(screen.getByRole("button", { name: /download as pdf/i }));

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    // Must never silently fall back to a fabricated client-side PDF.
    expect(URL.createObjectURL).not.toHaveBeenCalled();

    const call = mockFetch.mock.calls.find((c) =>
      String(c[0]).includes("/documents/export/pdf"),
    );
    expect(call).toBeDefined();
    expect(String(call?.[0])).toContain("/api/v1/documents/export/pdf");
  });
});
