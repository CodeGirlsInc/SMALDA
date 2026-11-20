import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NotificationBell from "@/components/layout/NotificationBell";

const mockRequest = jest.fn();
const mockRouterPush = jest.fn();

jest.mock("@/lib/api-client", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

jest.mock("@/lib/api-config", () => ({
  apiUrl: (path: string, params?: Record<string, string | number>) => {
    const query = params
      ? `?${new URLSearchParams(
          Object.entries(params).map(([key, value]) => [key, String(value)]),
        ).toString()}`
      : "";
    return `http://localhost:3001/api/v1${path}${query}`;
  },
}));

jest.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

class MockWebSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn();
}

const originalFlag = process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED;
let visibilityState = "visible";

function arrangeUnreadNotification(
  markAllRead: () => Promise<unknown> = () => Promise.resolve(undefined),
) {
  mockRequest.mockImplementation((url: string) => {
    if (url.includes("/notifications/read-all")) return markAllRead();
    if (url.includes("unread-count")) return Promise.resolve({ count: 1 });
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
  beforeAll(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
  });

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED = originalFlag;
    }
  });

  beforeEach(() => {
    visibilityState = "visible";
    process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED = "true";
    mockRequest.mockReset();
    mockRouterPush.mockReset();
    Object.defineProperty(globalThis, "WebSocket", {
      value: MockWebSocket,
      configurable: true,
    });
    arrangeUnreadNotification();
  });

  it("does not render or request notifications when the feature is disabled", () => {
    delete process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED;

    const { container } = renderBell();

    expect(container).toBeEmptyDOMElement();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("does not poll while the tab is hidden", () => {
    visibilityState = "hidden";

    renderBell();

    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("keeps notifications unread when mark-all-read fails", async () => {
    arrangeUnreadNotification(() => Promise.reject(new Error("request failed")));
    renderBell();

    fireEvent.click(
      await screen.findByRole("button", { name: /notifications, 1 unread/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/notifications/read-all",
        { method: "PATCH" },
      ),
    );
    expect(
      screen.getByRole("button", { name: /notifications, 1 unread/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeInTheDocument();
  });

  it("updates notifications only after mark-all-read succeeds", async () => {
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
