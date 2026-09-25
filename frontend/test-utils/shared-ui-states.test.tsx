import React from "react";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";

describe("shared empty and loading states", () => {
  it("renders an optional visual slot", () => {
    render(
      <EmptyState
        title="No documents"
        icon={<svg data-testid="document-icon" aria-label="Document" />}
      />,
    );

    expect(screen.getByTestId("empty-state-icon")).toContainElement(
      screen.getByTestId("document-icon"),
    );
  });

  it("keeps legacy empty-state props", () => {
    render(
      <EmptyState
        title="No matches"
        description="Try changing the filters."
        variant="no-match"
      />,
    );

    expect(screen.getByTestId("empty-state")).toHaveAttribute(
      "data-variant",
      "no-match",
    );
    expect(screen.queryByTestId("empty-state-icon")).not.toBeInTheDocument();
  });

  it("enables pulse animation only when motion is safe", () => {
    const { container } = render(<Skeleton />);

    expect(container.firstElementChild).toHaveClass(
      "motion-safe:animate-pulse",
      "motion-reduce:animate-none",
    );
    expect(container.firstElementChild).not.toHaveClass("animate-pulse");
  });
});
