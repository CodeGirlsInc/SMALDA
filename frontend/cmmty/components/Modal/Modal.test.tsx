import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Modal from "./Modal";

describe("Modal", () => {
  // --- Renders correctly ---
  it("renders provided title and content", () => {
    render(
      <Modal open title="Test Modal">
        <p>Body content</p>
      </Modal>,
    );

    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <Modal open title="Test Modal" description="A description">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByText("A description")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    render(
      <Modal open title="Test Modal">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByText("A description")).not.toBeInTheDocument();
  });

  it("has dialog role and aria-modal", () => {
    render(
      <Modal open title="Test Modal">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("does not render when open is false", () => {
    render(
      <Modal open={false} title="Test Modal">
        <p>Body content</p>
      </Modal>,
    );
    expect(screen.queryByText("Test Modal")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // --- Handles user interaction ---
  it("calls onClose on ESC press", () => {
    const onClose = jest.fn();

    render(
      <Modal open title="Esc test" onClose={onClose}>
        <p>Body content</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = jest.fn();

    render(
      <Modal open title="Close test" onClose={onClose}>
        <p>Body content</p>
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: /close modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = jest.fn();

    render(
      <Modal open title="Backdrop test" onClose={onClose}>
        <p>Body content</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when content area is clicked", () => {
    const onClose = jest.fn();

    render(
      <Modal open title="Content click" onClose={onClose}>
        <p>Body content</p>
      </Modal>,
    );

    fireEvent.click(screen.getByText("Body content"));
    expect(onClose).not.toHaveBeenCalled();
  });

  // --- Size variants ---
  it("applies sm size class", () => {
    render(
      <Modal open title="Small" size="sm">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog").querySelector("div");
    expect(dialog).toHaveClass("max-w-sm");
  });

  it("applies lg size class", () => {
    render(
      <Modal open title="Large" size="lg">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog").querySelector("div");
    expect(dialog).toHaveClass("max-w-2xl");
  });
});
