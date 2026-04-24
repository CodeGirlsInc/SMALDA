import { fireEvent, render, screen } from "@testing-library/react";
import Modal from "./Modal";

describe("Modal", () => {
  it("renders provided content", () => {
    render(
      <Modal open title="Test Modal">
        <p>Body content</p>
      </Modal>,
    );

    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("calls onClose on ESC press", () => {
    const onClose = jest.fn();

    render(
      <Modal open title="Esc test" onClose={onClose}>
        <p>Body content</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
