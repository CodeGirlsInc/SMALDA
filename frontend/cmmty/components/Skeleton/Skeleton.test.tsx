import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Skeleton from "./index";

describe("Skeleton", () => {
  // --- Renders correctly ---
  it("renders with status role and loading label", () => {
    render(<Skeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders screen reader text", () => {
    render(<Skeleton />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("applies text variant classes by default", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("rounded");
  });

  it("applies circular variant classes", () => {
    const { container } = render(<Skeleton variant="circular" />);
    expect(container.firstChild).toHaveClass("rounded-full");
  });

  it("applies rectangular variant classes", () => {
    const { container } = render(<Skeleton variant="rectangular" />);
    expect(container.firstChild).toHaveClass("rounded-md");
  });

  // --- Handles different states ---
  it("applies pulse animation by default", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("does not apply animation when animation is none", () => {
    const { container } = render(<Skeleton animation="none" />);
    expect(container.firstChild).not.toHaveClass("animate-pulse");
  });

  it("applies wave animation class", () => {
    const { container } = render(<Skeleton animation="wave" />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  // --- Dimensions ---
  it("applies width style when provided as number", () => {
    const { container } = render(<Skeleton width={200} />);
    expect(container.firstChild).toHaveStyle({ width: "200px" });
  });

  it("applies width style when provided as string", () => {
    const { container } = render(<Skeleton width="50%" />);
    expect(container.firstChild).toHaveStyle({ width: "50%" });
  });

  it("applies height style when provided", () => {
    const { container } = render(<Skeleton height={40} />);
    expect(container.firstChild).toHaveStyle({ height: "40px" });
  });

  it("applies both width and height", () => {
    const { container } = render(<Skeleton width={200} height={20} />);
    expect(container.firstChild).toHaveStyle({ width: "200px", height: "20px" });
  });

  // --- Custom class ---
  it("merges custom className", () => {
    const { container } = render(<Skeleton className="my-skeleton" />);
    expect(container.firstChild).toHaveClass("my-skeleton");
  });

  it("has bg-gray-200 background", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("bg-gray-200");
  });
});
