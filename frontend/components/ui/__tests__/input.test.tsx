import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "../input";

describe("Input", () => {
  it("renders a textbox", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
  });

  it("defaults to type=text and the md size", () => {
    render(<Input aria-label="Email" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveClass("h-10", "border-input");
  });

  it("applies the requested size", () => {
    render(<Input aria-label="Email" inputSize="lg" />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveClass("h-11");
  });

  it("marks the field invalid when variant is error", () => {
    render(<Input aria-label="Email" variant="error" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveClass("border-destructive");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("does not set aria-invalid on the default variant", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute("aria-invalid");
  });

  it("lets an explicit aria-invalid override the variant default", () => {
    render(<Input aria-label="Email" variant="error" aria-invalid={false} />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "false");
  });

  it("lets a caller className override the variant border", () => {
    render(<Input aria-label="Email" className="border-green-500" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveClass("border-green-500");
    expect(input).not.toHaveClass("border-input");
  });

  it("accepts typed text", () => {
    render(<Input aria-label="Email" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    fireEvent.change(input, { target: { value: "ada@example.com" } });
    expect(input).toHaveValue("ada@example.com");
  });

  it("forwards a ref to the underlying input", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input aria-label="Email" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
