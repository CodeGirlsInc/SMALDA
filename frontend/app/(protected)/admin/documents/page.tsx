"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types matching the backend Document entity + User owner
// ---------------------------------------------------------------------------

type DocumentStatus =
  | "pending"
  | "analyzing"
  | "verified"
  | "flagged"
  | "rejected";

interface AdminDocument {
  id: string;
  title: string;
  status: DocumentStatus;
  riskScore?: number | null;
  riskFlags?: string[] | null;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    fullName: string;
  };
}

interface PaginatedResponse {
  data: AdminDocument[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function riskColor(score?: number | null): string {
  if (score == null) return "text-gray-400";
  if (score >= 0.7) return "text-red-600 font-semibold";
  if (score >= 0.4) return "text-yellow-600 font-semibold";
  return "text-green-600 font-semibold";
}

function statusBadge(status: DocumentStatus): string {
  const base = "inline-block px-2 py-0.5 rounded text-xs font-medium";
  switch (status) {
    case "verified":
      return `${base} bg-green-100 text-green-800`;
    case "flagged":
      return `${base} bg-red-100 text-red-800`;
    case "rejected":
      return `${base} bg-gray-200 text-gray-700`;
    case "analyzing":
      return `${base} bg-blue-100 text-blue-800`;
    default:
      return `${base} bg-yellow-100 text-yellow-800`;
  }
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

interface Filters {
  status: string;
  ownerEmail: string;
  riskMin: number;
  riskMax: number;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: Filters = {
  status: "",
  ownerEmail: "",
  riskMin: 0,
  riskMax: 1,
  dateFrom: "",
  dateTo: "",
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AdminDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<Filters>(DEFAULT_FILTERS);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(
    async (currentPage: number, f: Filters) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
      });

      if (f.status) params.set("status", f.status);
      if (f.ownerEmail) params.set("ownerEmail", f.ownerEmail);
      if (f.riskMin > 0) params.set("riskMin", String(f.riskMin));
      if (f.riskMax < 1) params.set("riskMax", String(f.riskMax));
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("auth-token")
            : null;

        const res = await fetch(
          `${API_BASE}/api/admin/documents?${params.toString()}`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const json: PaginatedResponse = await res.json();
        setDocuments(json.data);
        setTotal(json.total);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load documents"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchDocuments(page, appliedFilters);
  }, [page, appliedFilters, fetchDocuments]);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({ ...filters });
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const handleDownload = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("auth-token")
        : null;

    try {
      const res = await fetch(`${API_BASE}/api/documents/${id}/export/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `document-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download document.");
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">All Documents</h1>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <section
        aria-label="Document filters"
        className="bg-white border rounded-lg p-4 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Status */}
          <div>
            <label
              htmlFor="status-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Status
            </label>
            <select
              id="status-filter"
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="analyzing">Analyzing</option>
              <option value="verified">Verified</option>
              <option value="flagged">Flagged</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Owner email */}
          <div>
            <label
              htmlFor="owner-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Owner email
            </label>
            <input
              id="owner-filter"
              type="text"
              placeholder="Search by email…"
              value={filters.ownerEmail}
              onChange={(e) =>
                setFilters((f) => ({ ...f, ownerEmail: e.target.value }))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date from */}
          <div>
            <label
              htmlFor="date-from"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Uploaded from
            </label>
            <input
              id="date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date to */}
          <div>
            <label
              htmlFor="date-to"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Uploaded to
            </label>
            <input
              id="date-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
              }
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Risk score range */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk score range:{" "}
              <span className="text-blue-600">
                {filters.riskMin.toFixed(1)} – {filters.riskMax.toFixed(1)}
              </span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={filters.riskMin}
                aria-label="Minimum risk score"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    riskMin: Math.min(Number(e.target.value), f.riskMax),
                  }))
                }
                className="flex-1"
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={filters.riskMax}
                aria-label="Maximum risk score"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    riskMax: Math.max(Number(e.target.value), f.riskMin),
                  }))
                }
                className="flex-1"
              />
              <span className="text-xs text-gray-500">1</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleApplyFilters}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Apply filters
          </button>
          <button
            onClick={handleResetFilters}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Reset
          </button>
        </div>
      </section>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {loading && (
        <p className="text-sm text-gray-500" role="status">
          Loading documents…
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && documents.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No documents match the current filters.</p>
          <p className="text-sm mt-1">
            Try adjusting your filters or reset them.
          </p>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Document name
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Owner
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Risk score
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Uploaded
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Flags
                </th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => router.push(`/documents/${doc.id}`)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                    {doc.title}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{doc.owner?.fullName ?? "—"}</div>
                    <div className="text-xs text-gray-500">
                      {doc.owner?.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(doc.status)}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={riskColor(doc.riskScore)}>
                      {doc.riskScore != null
                        ? doc.riskScore.toFixed(2)
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                    {doc.riskFlags && doc.riskFlags.length > 0 ? (
                      <ul className="list-disc list-inside text-xs space-y-0.5">
                        {doc.riskFlags.slice(0, 3).map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                        {doc.riskFlags.length > 3 && (
                          <li className="text-gray-400">
                            +{doc.riskFlags.length - 3} more
                          </li>
                        )}
                      </ul>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => handleDownload(doc.id, e)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                      aria-label={`Download ${doc.title}`}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between text-sm"
        >
          <p className="text-gray-600">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </main>
  );
}