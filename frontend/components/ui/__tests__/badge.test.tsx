import React from "react";
import { render, screen } from "@testing-library/react";
import { Badge } from "../badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Verified</Badge>);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("applies the default variant classes", () => {
    render(<Badge data-testid="badge">Verified</Badge>);
    expect(screen.getByTestId("badge")).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("applies the secondary variant", () => {
    render(
      <Badge data-testid="badge" variant="secondary">
        Draft
      </Badge>
    );
    expect(screen.getByTestId("badge")).toHaveClass("bg-secondary", "text-secondary-foreground");
  });

  it("applies the destructive variant", () => {
    render(
      <Badge data-testid="badge" variant="destructive">
        Flagged
      </Badge>
    );
    expect(screen.getByTestId("badge")).toHaveClass("bg-destructive");
  });

  it("gives the success variant an explicit dark-mode pairing", () => {
    render(
      <Badge data-testid="badge" variant="success">
        Approved
      </Badge>
    );
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-green-100", "text-green-800");
    expect(badge).toHaveClass("dark:bg-green-950", "dark:text-green-300");
  });

  it("gives the warning variant an explicit dark-mode pairing", () => {
    render(
      <Badge data-testid="badge" variant="warning">
        Pending
      </Badge>
    );
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-amber-100", "text-amber-800");
    expect(badge).toHaveClass("dark:bg-amber-950", "dark:text-amber-300");
  });

  it("applies the outline variant without a filled background", () => {
    render(
      <Badge data-testid="badge" variant="outline">
        Neutral
      </Badge>
    );
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("border-border", "text-foreground");
    expect(badge).not.toHaveClass("bg-primary");
  });

  it("lets a caller className override the variant background", () => {
    render(
      <Badge data-testid="badge" className="bg-red-500">
        Verified
      </Badge>
    );
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-red-500");
    expect(badge).not.toHaveClass("bg-primary");
  });

  it("renders a span element", () => {
    render(<Badge data-testid="badge">Verified</Badge>);
    expect(screen.getByTestId("badge").tagName).toBe("SPAN");
  });
});
