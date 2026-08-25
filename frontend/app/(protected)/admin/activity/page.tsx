"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CircleUser } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Activity {
  id: string;
  userId: string;
  user_email: string;
  actionType: string;
  action: string;
  created_at: string;
}

interface PaginatedActivity {
  data: Activity[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const MOCK_ACTIVITY: Activity[] = [
  {
    id: "1",
    userId: "u1",
    user_email: "admin@example.com",
    actionType: "login",
    action: "User login",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    userId: "u2",
    user_email: "test@example.com",
    actionType: "upload",
    action: 'File upload: "document.pdf"',
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "3",
    userId: "u3",
    user_email: "admin@example.com",
    actionType: "delete",
    action: 'File delete: "image.jpg"',
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: "4",
    userId: "u4",
    user_email: "guest@example.com",
    actionType: "view",
    action: 'Viewed page: "Dashboard"',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
];

const ACTION_TYPES = ["login", "upload", "delete", "view", "verify", "dispute"];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [userId, setUserId] = useState("");
  const [actionType, setActionType] = useState("");
  const [appliedUserId, setAppliedUserId] = useState("");
  const [appliedActionType, setAppliedActionType] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (appliedUserId) params.set("userId", appliedUserId);
    if (appliedActionType) params.set("actionType", appliedActionType);

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/activity?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!res.ok) throw new Error(`Failed to load activity (${res.status})`);
      const json: PaginatedActivity = await res.json();
      const list = Array.isArray(json) ? json : (json?.data ?? []);
      // Most recent first.
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setActivities(sorted);
      setTotal(json?.total ?? sorted.length);
    } catch (err) {
      // Backend may be unavailable — fall back to sample data.
      const filtered = MOCK_ACTIVITY.filter(
        (a) =>
          (!appliedUserId || a.userId === appliedUserId) &&
          (!appliedActionType || a.actionType === appliedActionType),
      );
      setActivities(filtered);
      setTotal(filtered.length);
      setError(
        err instanceof Error
          ? `${err.message} — showing sample data`
          : "Showing sample data",
      );
    } finally {
      setLoading(false);
    }
  }, [page, appliedUserId, appliedActionType]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const handleApply = () => {
    setPage(1);
    setAppliedUserId(userId.trim());
    setAppliedActionType(actionType);
  };

  const handleReset = () => {
    setUserId("");
    setActionType("");
    setAppliedUserId("");
    setAppliedActionType("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (accessDenied) {
    return (
      <main className="p-4 md:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-800">
            Admin access required
          </h1>
          <p className="mt-1 text-sm text-red-700">
            You need an administrator account to view the activity timeline.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8">
      <h1 className="mb-1 text-2xl font-bold">User Activity Timeline</h1>
      <p className="mb-6 text-sm text-gray-500">
        Paginated user-action timeline, most recent first.
      </p>

      {/* Filters */}
      <section
        aria-label="Activity filters"
        className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="userId-filter"
            className="text-sm font-medium text-gray-700"
          >
            User ID
          </label>
          <input
            id="userId-filter"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Filter by user id"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="actionType-filter"
            className="text-sm font-medium text-gray-700"
          >
            Action type
          </label>
          <select
            id="actionType-filter"
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All action types</option>
            {ACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleApply}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            onClick={handleReset}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </section>

      {error && (
        <p role="status" className="mb-4 text-xs text-gray-500">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900">Activity feed</h2>
          <p className="text-xs text-gray-500">
            {total} {total === 1 ? "event" : "events"}
          </p>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-gray-500" role="status">
            Loading activity…
          </p>
        ) : activities.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-500">No activity found.</p>
          </div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
            {activities.map((activity) => (
              <div key={activity.id} className="relative mb-8 pl-8">
                <div className="absolute left-[-4px] top-1 h-4 w-4 rounded-full border-4 border-white bg-blue-500" />
                <div className="flex items-center gap-2">
                  <CircleUser className="h-5 w-5 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-900">
                    {activity.user_email}
                  </p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {activity.actionType}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{activity.action}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(activity.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm"
          >
            <p className="text-gray-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded border px-3 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded border px-3 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}
