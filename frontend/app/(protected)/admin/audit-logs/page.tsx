"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

interface AuditLog {
  id: string;
  routePath: string;
  httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  ipAddress: string;
  statusCode: number | null;
  createdAt: string;
}

interface PaginatedAccessLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 20;

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminAuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    userId: "",
    startDate: "",
    endDate: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (appliedFilters.userId) params.set("userId", appliedFilters.userId);
    if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
    if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);

    try {
      const response = await fetch(`${API_BASE}/admin/access-logs?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to load audit logs (${response.status})`);
      }

      const result = (await response.json()) as PaginatedAccessLogs;
      setAuditLogs(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? 0);
    } catch (fetchError) {
      setAuditLogs([]);
      setTotal(0);
      setTotalPages(0);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load audit logs",
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  function applyFilters() {
    setPage(1);
    setAppliedFilters({
      userId: userId.trim(),
      startDate,
      endDate,
    });
  }

  function resetFilters() {
    setUserId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    setAppliedFilters({ userId: "", startDate: "", endDate: "" });
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">HTTP Access Logs</h1>
        <p className="text-sm text-gray-500">
          Showing at most {PAGE_SIZE} access logs per page.
        </p>
      </div>

      <section
        aria-label="Audit log filters"
        className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-user-id" className="text-sm font-medium text-gray-700">
            User ID
          </label>
          <input
            id="audit-user-id"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-start-date" className="text-sm font-medium text-gray-700">
            From
          </label>
          <input
            id="audit-start-date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-end-date" className="text-sm font-medium text-gray-700">
            To
          </label>
          <input
            id="audit-end-date"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            {total} {total === 1 ? "request" : "requests"} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-sm text-gray-500" role="status">
              Loading audit logs…
            </p>
          ) : auditLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No audit logs found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.ipAddress}</TableCell>
                      <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{log.httpMethod}</TableCell>
                      <TableCell>{log.routePath}</TableCell>
                      <TableCell>{log.statusCode ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 ? (
            <nav
              aria-label="Audit log pagination"
              className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm"
            >
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1 || loading}
                  className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages || loading}
                  className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
