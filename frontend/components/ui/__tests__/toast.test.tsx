import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast, type ToastOptions } from "../use-toast";
import { Toaster } from "../toast";

function Harness({ options }: { options?: ToastOptions }) {
  const { toast } = useToast();
  return <button onClick={() => toast(options ?? { title: "Saved" })}>Fire</button>;
}

function Counter() {
  const { toast } = useToast();
  const n = React.useRef(0);
  return <button onClick={() => toast({ title: `Toast ${n.current++}` })}>Fire</button>;
}

function renderToasts(options?: ToastOptions) {
  return render(
    <ToastProvider>
      <Harness options={options} />
      <Toaster />
    </ToastProvider>
  );
}

function fire() {
  fireEvent.click(screen.getByRole("button", { name: "Fire" }));
}

describe("Toast", () => {
  it("renders an empty polite live region before any toast fires", () => {
    renderToasts();
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("shows a toast title after firing", () => {
    renderToasts();
    fire();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("shows the description when provided", () => {
    renderToasts({ title: "Saved", description: "Your document was stored." });
    fire();
    expect(screen.getByText("Your document was stored.")).toBeInTheDocument();
  });

  it("applies the success variant classes", () => {
    renderToasts({ title: "Saved", variant: "success" });
    fire();
    const toast = screen.getByTestId("toast");
    expect(toast).toHaveClass("bg-green-100", "text-green-900");
    expect(toast).toHaveClass("dark:bg-green-950", "dark:text-green-100");
  });

  it("announces a destructive toast assertively", () => {
    renderToasts({ title: "Upload failed", variant: "destructive" });
    fire();
    const toast = screen.getByTestId("toast");
    expect(toast).toHaveAttribute("role", "alert");
    expect(toast).toHaveAttribute("aria-live", "assertive");
  });

  it("removes the toast when its close button is clicked", () => {
    renderToasts();
    fire();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the default 5000ms", () => {
    jest.useFakeTimers();
    try {
      renderToasts();
      fire();
      expect(screen.getByText("Saved")).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not auto-dismiss when duration is 0", () => {
    jest.useFakeTimers();
    try {
      renderToasts({ title: "Sticky", duration: 0 });
      fire();
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByText("Sticky")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps at most three toasts, dropping the oldest", () => {
    render(
      <ToastProvider>
        <Counter />
        <Toaster />
      </ToastProvider>
    );
    for (let i = 0; i < 4; i++) {
      fire();
    }
    expect(screen.getAllByTestId("toast")).toHaveLength(3);
    expect(screen.queryByText("Toast 0")).not.toBeInTheDocument();
    expect(screen.getByText("Toast 3")).toBeInTheDocument();
  });

  it("throws a helpful error when useToast is used outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Harness />)).toThrow(/useToast must be used within a ToastProvider/);
    } finally {
      spy.mockRestore();
    }
  });
});
