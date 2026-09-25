import React from "react";
import { render, screen } from "@testing-library/react";
import { ReferenceCard } from "../ReferenceCard";

describe("ReferenceCard", () => {
  it("renders its title", () => {
    render(<ReferenceCard title="Land registry reference" />);

    expect(screen.getByRole("heading", { name: "Land registry reference" })).toBeInTheDocument();
  });

  it("renders the optional description when provided", () => {
    render(
      <ReferenceCard
        title="Document reference"
        description="Details from the authoritative registry"
      />,
    );

    expect(screen.getByText("Details from the authoritative registry")).toBeInTheDocument();
  });

  it("renders children in the content area", () => {
    render(
      <ReferenceCard title="Reference">
        <a href="/documents/123">Open document</a>
      </ReferenceCard>,
    );

    expect(screen.getByRole("link", { name: "Open document" })).toHaveAttribute(
      "href",
      "/documents/123",
    );
    expect(screen.getByRole("link", { name: "Open document" }).parentElement).toHaveClass(
      "mt-4",
    );
  });

  it("uses theme-aware card colors", () => {
    const { container } = render(
      <ReferenceCard title="Reference" description="Registry details" />,
    );

    expect(container.firstElementChild).toHaveClass(
      "bg-card",
      "text-card-foreground",
      "border-border",
    );
    expect(screen.getByText("Registry details")).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("omits optional description and content wrappers when values are absent", () => {
    const { container } = render(<ReferenceCard title="Reference" />);

    expect(screen.queryByText("Details from the authoritative registry")).not.toBeInTheDocument();
    expect(container.querySelector(".mt-1")).not.toBeInTheDocument();
    expect(container.querySelector(".mt-4")).not.toBeInTheDocument();
  });
});
