import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AdminProvidersError from "@/app/[locale]/(protected)/admin/providers/error";

const mockReset = jest.fn();

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

describe("AdminProvidersError", () => {
  beforeEach(() => mockReset.mockClear());

  it("renders a providers-scoped error and retries the failed segment", () => {
    render(<AdminProvidersError error={new Error("health request failed")} reset={mockReset} />);

    expect(screen.getByRole("heading", { name: "Provider health unavailable" })).toBeInTheDocument();
    expect(
      screen.getByText("Validation provider health could not be loaded. Other admin pages remain available."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("keeps navigation scoped to the admin area", () => {
    render(<AdminProvidersError error={new Error("health request failed")} reset={mockReset} />);

    expect(screen.getByRole("link", { name: "Back to admin" })).toHaveAttribute("href", "/admin");
  });
});
