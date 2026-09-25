import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SkipToContentLink } from "@/components/layout/SkipToContentLink";
import { MAIN_CONTENT_ID } from "@/lib/main-content";

function RouteFixture({ label }: { label: string }) {
  return (
    <>
      <SkipToContentLink />
      <div id={MAIN_CONTENT_ID} tabIndex={-1}>
        <main key={label} data-testid="route-main">
          {label}
        </main>
      </div>
    </>
  );
}

describe("SkipToContentLink", () => {
  it("stays visually hidden until focused and uses theme focus tokens", () => {
    render(<SkipToContentLink />);

    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("href", `#${MAIN_CONTENT_ID}`);
    expect(link).toHaveClass(
      "sr-only",
      "focus:not-sr-only",
      "focus:bg-primary",
      "focus:text-primary-foreground",
      "focus:ring-ring",
      "focus:ring-offset-background",
    );
  });

  it("moves focus to the current main landmark after navigation", () => {
    const { rerender } = render(<RouteFixture label="Dashboard" />);
    const firstMain = screen.getByTestId("route-main");

    fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));

    expect(firstMain).toHaveAttribute("id", MAIN_CONTENT_ID);
    expect(firstMain).toHaveAttribute("tabindex", "-1");
    expect(firstMain).toHaveAttribute("data-skip-link-target", "true");
    expect(firstMain).toHaveFocus();

    rerender(<RouteFixture label="Documents" />);
    const secondMain = screen.getByTestId("route-main");
    expect(secondMain).not.toBe(firstMain);

    fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));

    expect(secondMain).toHaveAttribute("id", MAIN_CONTENT_ID);
    expect(secondMain).toHaveAttribute("tabindex", "-1");
    expect(secondMain).toHaveAttribute("data-skip-link-target", "true");
    expect(secondMain).toHaveFocus();
  });
});
