import { fireEvent, render, screen } from "@testing-library/react";
import Input from "./Input";

describe("Input", () => {
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

  it("toggles password visibility", () => {
    render(<Input id="password" label="Password" type="password" />);

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(input).toHaveAttribute("type", "text");
  });
});
