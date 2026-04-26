import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Input from "./Input";

describe("Input", () => {
  // --- Renders correctly ---
  it("renders with label and placeholder", () => {
    render(<Input id="email" label="Email" placeholder="Enter email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter email")).toBeInTheDocument();
  });

  it("renders without label when not provided", () => {
    render(<Input id="name" placeholder="Your name" />);
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
  });

  it("renders with helper text", () => {
    render(<Input id="email" helperText="We'll never share your email" />);
    expect(screen.getByText("We'll never share your email")).toBeInTheDocument();
  });

  // --- Shows correct state (error) ---
  it("shows error state and message", () => {
    render(
      <Input
        id="email"
        label="Email"
        error
        errorMessage="Email is required"
        placeholder="Enter email"
      />,
    );

    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("applies error border class when error is true", () => {
    render(<Input id="email" label="Email" error />);
    expect(screen.getByLabelText("Email")).toHaveClass("border-red-500");
  });

  it("applies normal border class when error is false", () => {
    render(<Input id="email" label="Email" />);
    expect(screen.getByLabelText("Email")).toHaveClass("border-gray-300");
  });

  // --- Handles user interaction ---
  it("toggles password visibility", () => {
    render(<Input id="password" label="Password" type="password" />);

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(input).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("accepts user input", () => {
    render(<Input id="name" label="Name" />);
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "John" } });
    expect(input).toHaveValue("John");
  });

  // --- Disabled state ---
  it("is disabled when disabled prop is true", () => {
    render(<Input id="email" label="Email" disabled />);
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });

  it("has disabled styles when disabled", () => {
    render(<Input id="email" label="Email" disabled />);
    expect(screen.getByLabelText("Email")).toHaveClass("disabled:bg-gray-100");
  });

  // --- Icon support ---
  it("renders left icon when provided", () => {
    const { container } = render(
      <Input id="search" label="Search" leftIcon={<span data-testid="left-icon">S</span>} />,
    );
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    expect(container.querySelector("input")).toHaveClass("pl-10");
  });

  it("renders right icon when provided", () => {
    const { container } = render(
      <Input id="search" label="Search" rightIcon={<span data-testid="right-icon">X</span>} />,
    );
    expect(screen.getByTestId("right-icon")).toBeInTheDocument();
    expect(container.querySelector("input")).toHaveClass("pr-10");
  });
});
