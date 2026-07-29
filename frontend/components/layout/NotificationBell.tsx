"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const WS_BASE = (
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001"
).replace(/^http/, "ws");

type NotificationType =
  | "risk_alert"
  | "verification_complete"
  | "dispute_update";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  documentId?: string;
  read: boolean;
  createdAt: string;
}

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  risk_alert: "\u26A0",
  verification_complete: "\u2713",
  dispute_update: "\u2691",
};

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSeconds = Math.round((now - then) / 1000);
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationTypeIcon({ type }: { type: NotificationType }) {
  const icon = NOTIFICATION_ICONS[type] ?? "\u2022";
  const colour =
    type === "risk_alert"
      ? "text-red-500"
      : type === "verification_complete"
        ? "text-green-500"
        : "text-blue-500";

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm ${colour}`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        fetch(`${API_BASE}/api/notifications?limit=5`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE}/api/notifications/unread-count`, {
          headers: getAuthHeaders(),
        }),
      ]);

      if (listRes.ok) {
        const data = await listRes.json();
        setNotifications(Array.isArray(data) ? data : (data?.data ?? []));
      }
      if (countRes.ok) {
        const data = await countRes.json();
        setUnreadCount(data?.count ?? data?.unreadCount ?? 0);
      }
    } catch {
      // Silently fail — notification polling is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ws = new WebSocket(`${WS_BASE}/notifications`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === "documentStatus") {
          fetchNotifications();
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => ws.close();

    return () => ws.close();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleMarkAllRead() {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }

  function handleNotificationClick(n: Notification) {
    setOpen(false);
    if (n.documentId) {
      router.push(`/documents/${n.documentId}`);
    }
  }

  const unreadNotifications = notifications.filter((n) => !n.read);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
            </h3>
            {unreadNotifications.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="flex flex-col gap-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded bg-gray-100"
                  />
                ))}
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-gray-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                </svg>
                <p className="text-sm text-gray-500">No notifications yet</p>
                <p className="text-xs text-gray-400">
                  Updates about your documents will appear here.
                </p>
              </div>
            )}

            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
                  !n.read ? "bg-blue-50/40" : ""
                }`}
                role="menuitem"
              >
                <NotificationTypeIcon type={n.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`truncate text-sm ${!n.read ? "font-semibold text-gray-900" : "text-gray-700"}`}
                    >
                      {n.title}
                    </p>
                    {!n.read && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-gray-500">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 px-4 py-2.5">
            <Link
              href="/settings/notifications"
              className="block text-center text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
