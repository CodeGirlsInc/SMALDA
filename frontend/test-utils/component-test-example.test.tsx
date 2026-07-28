import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./test-utils";

function SimpleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded bg-blue-600 px-4 py-2 text-white">
      {label}
    </button>
  );
}

function DataDisplay({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <p data-testid="count">{count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
      <button onClick={() => setCount((c) => c - 1)}>Decrement</button>
    </div>
  );
}

describe("Component testing reference patterns", () => {
  describe("Simple component test", () => {
    it("renders a button with the correct label", () => {
      render(<SimpleButton label="Click me" onClick={() => {}} />);
      expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
    });

    it("calls onClick when button is clicked", async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      render(<SimpleButton label="Click me" onClick={handleClick} />);
      await user.click(screen.getByRole("button", { name: /click me/i }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Data display component test", () => {
    it("renders label and value", () => {
      render(<DataDisplay value="42" label="Score" />);
      expect(screen.getByText("Score")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("renders numeric values", () => {
      render(<DataDisplay value={99} label="Count" />);
      expect(screen.getByText("99")).toBeInTheDocument();
    });
  });

  describe("Form/interaction component test", () => {
    it("increments counter on click", async () => {
      const user = userEvent.setup();
      render(<Counter />);
      expect(screen.getByTestId("count")).toHaveTextContent("0");
      await user.click(screen.getByRole("button", { name: /increment/i }));
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    it("decrements counter on click", async () => {
      const user = userEvent.setup();
      render(<Counter />);
      await user.click(screen.getByRole("button", { name: /decrement/i }));
      expect(screen.getByTestId("count")).toHaveTextContent("-1");
    });
  });

  describe("Provider-wrapped component test", () => {
    it("renders with intl provider", () => {
      renderWithProviders(<SimpleButton label="Test" onClick={() => {}} />);
      expect(screen.getByRole("button", { name: /test/i })).toBeInTheDocument();
    });
  });
});
