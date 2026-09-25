import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NotificationBell from "@/components/layout/NotificationBell";

const mockRequest = jest.fn();
const mockRequestRaw = jest.fn();
const mockRouterPush = jest.fn();

jest.mock("@/lib/api-client", () => ({
  getApiUrl: (path: string) => `http://localhost:3001/api/v1/${path}`,
  request: (...args: unknown[]) => mockRequest(...args),
  requestRaw: (...args: unknown[]) => mockRequestRaw(...args),
}));

jest.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

class MockWebSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn();
}

function arrangeUnreadNotification() {
  mockRequest.mockImplementation((url: string) => {
    if (url.includes("unread-count")) {
      return Promise.resolve({ count: 1 });
    }
    return Promise.resolve([
      {
        id: "notification-1",
        type: "verification_complete",
        title: "Verification complete",
        body: "Your document is ready",
        read: false,
        createdAt: new Date().toISOString(),
      },
    ]);
  });
}

function renderBell() {
  return render(<NotificationBell />);
}

describe("NotificationBell", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequestRaw.mockReset();
    mockRouterPush.mockReset();
    Object.defineProperty(globalThis, "WebSocket", {
      value: MockWebSocket,
      configurable: true,
    });
    arrangeUnreadNotification();
  });

  it("keeps notifications unread when mark-all-read fails", async () => {
    mockRequestRaw.mockRejectedValue(new Error("request failed"));
    renderBell();

    fireEvent.click(
      await screen.findByRole("button", { name: /notifications, 1 unread/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    await waitFor(() => expect(mockRequestRaw).toHaveBeenCalledTimes(1));
    expect(mockRequestRaw).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/notifications/read-all",
      { method: "PATCH" },
    );
    expect(
      screen.getByRole("button", { name: /notifications, 1 unread/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeInTheDocument();
  });

  it("updates notifications only after mark-all-read succeeds", async () => {
    mockRequestRaw.mockResolvedValue({} as Response);
    renderBell();

    fireEvent.click(
      await screen.findByRole("button", { name: /notifications, 1 unread/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Notifications" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Mark all as read" }),
      ).not.toBeInTheDocument();
    });
  });
});
