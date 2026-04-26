import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ToastProvider, useToast } from "./useToast";
import ToastStack from "./Toast";

function Trigger({
  title = "Saved",
  type = "success",
  description,
  duration = 500,
}: {
  title?: string;
  type?: "success" | "error" | "warning" | "info";
  description?: string;
  duration?: number;
} = {}) {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast({ title, type, description, duration })}>
      Trigger
    </button>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // --- Renders correctly ---
  it("displays toast with title", () => {
    render(
      <ToastProvider>
        <Trigger />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("displays toast with description", () => {
    render(
      <ToastProvider>
        <Trigger title="Error" type="error" description="Something went wrong" />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders toast with status role", () => {
    render(
      <ToastProvider>
        <Trigger />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // --- Different toast types ---
  it("renders success toast with correct styles", () => {
    render(
      <ToastProvider>
        <Trigger type="success" />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("bg-emerald-50");
  });

  it("renders error toast with correct styles", () => {
    render(
      <ToastProvider>
        <Trigger title="Error" type="error" />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("bg-red-50");
  });

  it("renders warning toast with correct styles", () => {
    render(
      <ToastProvider>
        <Trigger title="Warning" type="warning" />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("bg-amber-50");
  });

  it("renders info toast with correct styles", () => {
    render(
      <ToastProvider>
        <Trigger title="Info" type="info" />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("bg-blue-50");
  });

  // --- Handles user interaction ---
  it("dismisses automatically after duration", () => {
    render(
      <ToastProvider>
        <Trigger />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.getByText("Saved")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("dismisses manually via close button", () => {
    render(
      <ToastProvider>
        <Trigger duration={60000} />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("renders dismiss button with accessible label", () => {
    render(
      <ToastProvider>
        <Trigger />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.getByRole("button", { name: /dismiss notification/i })).toBeInTheDocument();
  });
});
