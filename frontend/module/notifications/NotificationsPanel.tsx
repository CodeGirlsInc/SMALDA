"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  resourceUrl?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) === 1 ? "" : "s"} ago`;
}

export default function NotificationsPanel() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const token = () => localStorage.getItem("access_token") ?? "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/module/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch {}
  }, [apiBase]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/module/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data ?? data);
      }
    } catch {}
  }, [apiBase]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleNotificationClick(n: Notification) {
    setOpen(false);
    try {
      await fetch(`${apiBase}/api/module/notifications/${n.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token()}` },
      });
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
    } catch {}
    if (n.resourceUrl) router.push(n.resourceUrl);
  }

  async function handleMarkAllRead() {
    try {
      await fetch(`${apiBase}/api/module/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token()}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-blue-600 hover:underline"
            >
              Mark all as read
            </button>
          </div>

          <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">
                No notifications
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        n.read ? "bg-transparent" : "bg-blue-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">{n.message}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
