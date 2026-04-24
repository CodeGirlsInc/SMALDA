import { render, screen, fireEvent } from "@testing-library/react";
import NotificationCenter, { Notification } from "./NotificationCenter";

const makeNotifications = (overrides: Partial<Notification>[] = []): Notification[] =>
  overrides.map((o, i) => ({
    id: String(i + 1),
    type: "info",
    title: `Notification ${i + 1}`,
    body: "Body text",
    timestamp: new Date(),
    read: false,
    ...o,
  }));

const openDropdown = () => fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

describe("NotificationCenter", () => {
  it("shows unread count badge", () => {
    render(<NotificationCenter initialNotifications={makeNotifications([{}, {}])} />);
    expect(screen.getByLabelText("2 unread notifications")).toBeInTheDocument();
  });

  it("shows no badge when all read", () => {
    render(<NotificationCenter initialNotifications={makeNotifications([{ read: true }])} />);
    expect(screen.queryByLabelText(/unread notifications/i)).toBeNull();
  });

  it("shows empty state when no notifications", () => {
    render(<NotificationCenter initialNotifications={[]} />);
    openDropdown();
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
  });

  it("marks individual notification as read on click", () => {
    render(<NotificationCenter initialNotifications={makeNotifications([{}, {}])} />);
    openDropdown();
    fireEvent.click(screen.getByText("Notification 1"));
    expect(screen.getByLabelText("1 unread notifications")).toBeInTheDocument();
  });

  it("marks all notifications as read", () => {
    render(<NotificationCenter initialNotifications={makeNotifications([{}, {}, {}])} />);
    openDropdown();
    fireEvent.click(screen.getByRole("button", { name: /mark all as read/i }));
    expect(screen.queryByLabelText(/unread notifications/i)).toBeNull();
  });
});
