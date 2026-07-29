import React from "react";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../card";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Body</Card>);
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("applies theme-aware token classes rather than hardcoded grays", () => {
    render(<Card data-testid="card">Body</Card>);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("bg-card", "text-card-foreground", "border-border");
    expect(card).not.toHaveClass("bg-white");
    expect(card).not.toHaveClass("border-gray-200");
  });

  it("applies the elevated variant", () => {
    render(
      <Card data-testid="card" variant="elevated">
        Body
      </Card>
    );
    expect(screen.getByTestId("card")).toHaveClass("shadow-md");
  });

  it("applies the outline variant without a card background", () => {
    render(
      <Card data-testid="card" variant="outline">
        Body
      </Card>
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("bg-transparent");
    expect(card).not.toHaveClass("bg-card");
  });

  it("lets a caller className override the variant background", () => {
    render(
      <Card data-testid="card" className="bg-red-500">
        Body
      </Card>
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("bg-red-500");
    expect(card).not.toHaveClass("bg-card");
  });

  it("renders CardTitle as a heading", () => {
    render(<CardTitle>Recent activity</CardTitle>);
    expect(screen.getByRole("heading", { name: "Recent activity" })).toBeInTheDocument();
  });

  it("renders CardDescription with muted token color", () => {
    render(<CardDescription data-testid="desc">Last 30 days</CardDescription>);
    const desc = screen.getByTestId("desc");
    expect(desc).toHaveTextContent("Last 30 days");
    expect(desc).toHaveClass("text-muted-foreground");
    expect(desc).not.toHaveClass("text-gray-500");
  });

  it("preserves the original header and content padding", () => {
    render(
      <>
        <CardHeader data-testid="header">H</CardHeader>
        <CardContent data-testid="content">C</CardContent>
      </>
    );
    expect(screen.getByTestId("header")).toHaveClass("p-5", "pb-0");
    expect(screen.getByTestId("content")).toHaveClass("p-5");
  });

  it("composes the full set of subcomponents", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });
});
