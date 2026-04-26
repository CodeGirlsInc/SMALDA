import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowRight } from "lucide-react";
import Button from "./Button";

describe("Button", () => {
  it("renders with default styles and children", () => {
    render(<Button>Click me</Button>);

    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass("bg-indigo-600");
  });

  it("shows a spinner and disables interaction when loading", async () => {
    const user = userEvent.setup();
    render(<Button isLoading>Submitting</Button>);

    const btn = screen.getByRole("button", { name: /submitting/i });
    expect(btn).toBeDisabled();
    expect(screen.getByTestId("spinner")).toBeInTheDocument();

    await user.click(btn);
    expect(btn).toBeDisabled();
  });

  it("renders left and right icons", () => {
    render(
      <Button leftIcon={<span data-testid="left-icon" />} rightIcon={<ArrowRight data-testid="right-icon" />}>
        Next
      </Button>
    );

    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    expect(screen.getByTestId("right-icon")).toBeInTheDocument();
  });
});
