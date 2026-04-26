"use client";

import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface Column<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  emptyState?: React.ReactNode;
}

type SortDir = "asc" | "desc" | null;

const PAGE_SIZE_OPTIONS = [5, 10, 25];

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize: initialPageSize = 10,
  emptyState,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortKey(null);
    }
    setPage(1);
  };

  const handlePageSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  if (data.length === 0) {
    return (
      <div data-testid="empty-state">
        {emptyState ?? (
          <p className="py-12 text-center text-sm text-muted-foreground">No data available.</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop table view */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={`px-4 py-3 text-left font-medium text-muted-foreground ${col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                    onClick={() => handleSort(col)}
                    aria-sort={
                      sortKey === col.key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        <span aria-hidden="true">
                          {sortKey === col.key && sortDir === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : sortKey === col.key && sortDir === "desc" ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-foreground">
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Desktop Pagination */}
        <div className="hidden md:flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={handlePageSize}
              className="rounded border border-border bg-background px-1 py-0.5 text-foreground"
              aria-label="Page size"
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-2 py-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Previous page"
            >
              ‹
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded px-2 py-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {paginated.map((row, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <dl className="space-y-2">
              {columns.map((col) => (
                <div key={String(col.key)} className="flex justify-between gap-2">
                  <dt className="text-xs text-muted-foreground shrink-0">
                    {col.header}
                  </dt>
                  <dd className="text-xs font-medium text-foreground text-right">
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? "")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        {/* Mobile Pagination */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted active:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted active:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
