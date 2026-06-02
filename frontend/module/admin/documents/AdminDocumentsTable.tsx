"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface AdminDocument {
  id: string;
  title: string;
  ownerEmail: string;
  status: string;
  riskScore: number | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  uploadedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  ANALYZING: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-green-100 text-green-700",
  FLAGGED: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 10;

function StatusBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-200" />
        </td>
      ))}
    </tr>
  );
}

export default function AdminDocumentsTable() {
  const [docs, setDocs] = useState<AdminDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  useEffect(() => {
    fetch(`${apiBase}/api/module/users/me`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then((u) => setIsAdmin(u.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [apiBase]);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(riskFilter ? { riskLevel: riskFilter } : {}),
      });
      const res = await fetch(
        `${apiBase}/api/module/admin/documents?${params}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      if (res.status === 403) throw new Error("403");
      if (!res.ok) throw new Error("Failed to load documents.");
      const data = await res.json();
      setDocs(data.data ?? data);
      setTotal(data.total ?? (data.data ?? data).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, riskFilter, apiBase]);

  useEffect(() => {
    if (isAdmin === null) return;
    if (!isAdmin) {
      setError("403");
      setLoading(false);
      return;
    }
    fetchDocs();
  }, [isAdmin, fetchDocs]);

  if (isAdmin === false || error === "403") {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-600">403 — You are not authorized to view this page.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {["", "PENDING", "ANALYZING", "VERIFIED", "FLAGGED", "REJECTED"].map(
            (s) => <option key={s} value={s}>{s || "All statuses"}</option>
          )}
        </select>
        <select
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {["", "LOW", "MEDIUM", "HIGH"].map(
            (r) => <option key={r} value={r}>{r || "All risk levels"}</option>
          )}
        </select>
      </div>

      {error && error !== "403" && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Owner Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Risk Score</th>
              <th className="px-4 py-3">Upload Date</th>
              <th className="px-4 py-3">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              : docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{doc.title}</td>
                    <td className="px-4 py-3 text-gray-600">{doc.ownerEmail}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={doc.status}
                        colorClass={STATUS_COLORS[doc.status] ?? "bg-gray-100 text-gray-600"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {doc.riskLevel ? (
                        <StatusBadge
                          label={doc.riskLevel}
                          colorClass={RISK_COLORS[doc.riskLevel]}
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/documents/${doc.id}`} className="text-blue-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
