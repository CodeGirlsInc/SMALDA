import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ReportsError from "@/app/[locale]/(protected)/reports/error";

const mockReset = jest.fn();

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

describe("ReportsError", () => {
  beforeEach(() => mockReset.mockClear());

  it("renders a reports-scoped error with a retry action", () => {
    render(<ReportsError error={new Error("reports request failed")} reset={mockReset} />);

    expect(screen.getByRole("heading", { name: "Reports unavailable" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("provides navigation back to the dashboard", () => {
    render(<ReportsError error={new Error("reports request failed")} reset={mockReset} />);

    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/");
  });
});
