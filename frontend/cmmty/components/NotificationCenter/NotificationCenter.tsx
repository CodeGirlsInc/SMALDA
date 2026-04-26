"use client";

import { useState } from "react";
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationCenterProps {
  initialNotifications?: Notification[];
}

const typeIcon = {
  info: <Info size={16} className="text-blue-500" />,
  success: <CheckCircle size={16} className="text-green-500" />,
  warning: <AlertTriangle size={16} className="text-yellow-500" />,
  error: <XCircle size={16} className="text-red-500" />,
};

export default function NotificationCenter({ initialNotifications = [] }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const markAllAsRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <div className="relative">
      {/* Bell trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                aria-label="Mark all as read"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-400">No notifications</li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !n.read ? "bg-indigo-50/40" : ""
                  }`}
                >
                  <span className="mt-0.5 shrink-0">{typeIcon[n.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${!n.read ? "text-gray-900" : "text-gray-600"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {formatDistanceToNow(n.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" aria-hidden="true" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
