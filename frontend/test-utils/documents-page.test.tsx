/**
 * FE-69 — Reference MSW integration test.
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
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  getPathname: () => "/admin/documents",
}));

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdminDocumentsPage />
    </NextIntlClientProvider>
  );
}

describe("AdminDocumentsPage (MSW)", () => {
  it("loads and renders documents from the mocked API", async () => {
    renderPage();

    expect(screen.getByRole("status")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Land Title Alpha")).toBeInTheDocument();
    });

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });
});
