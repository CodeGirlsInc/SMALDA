import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "./useToast";
import ToastStack from "./Toast";

function Trigger() {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast({ title: "Saved", type: "success", duration: 500 })}>
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

  it("displays toast and dismisses automatically", () => {
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

  it("dismisses manually", () => {
    render(
      <ToastProvider>
        <Trigger />
        <ToastStack />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Trigger"));
    fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
});
