import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Badge from "./index";
import { DocumentStatus } from "../../types/document";

describe("Badge", () => {
  it.each([
    [DocumentStatus.PENDING, "Pending"],
    [DocumentStatus.ANALYZING, "Analyzing"],
    [DocumentStatus.VERIFIED, "Verified"],
    [DocumentStatus.FLAGGED, "Flagged"],
    [DocumentStatus.REJECTED, "Rejected"],
  ])("renders %s status with label %s", (status, label) => {
    render(<Badge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies sm size classes", () => {
    const { container } = render(<Badge status={DocumentStatus.VERIFIED} size="sm" />);
    expect(container.firstChild).toHaveClass("text-xs");
  });

  it("applies md size classes", () => {
    const { container } = render(<Badge status={DocumentStatus.VERIFIED} size="md" />);
    expect(container.firstChild).toHaveClass("text-sm");
  });

  it("renders dot mode without text", () => {
    render(<Badge status={DocumentStatus.PENDING} dot />);
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });

  it("dot mode has aria-label", () => {
    render(<Badge status={DocumentStatus.PENDING} dot />);
    expect(screen.getByLabelText("Pending")).toBeInTheDocument();
  });

  it("PENDING uses gray color", () => {
    const { container } = render(<Badge status={DocumentStatus.PENDING} />);
    expect(container.firstChild).toHaveClass("bg-gray-100");
  });

  it("ANALYZING uses blue color", () => {
    const { container } = render(<Badge status={DocumentStatus.ANALYZING} />);
    expect(container.firstChild).toHaveClass("bg-blue-100");
  });

  it("VERIFIED uses green color", () => {
    const { container } = render(<Badge status={DocumentStatus.VERIFIED} />);
    expect(container.firstChild).toHaveClass("bg-green-100");
  });

  it("FLAGGED uses yellow color", () => {
    const { container } = render(<Badge status={DocumentStatus.FLAGGED} />);
    expect(container.firstChild).toHaveClass("bg-yellow-100");
  });

  it("REJECTED uses red color", () => {
    const { container } = render(<Badge status={DocumentStatus.REJECTED} />);
    expect(container.firstChild).toHaveClass("bg-red-100");
  });
});
