"use client";

import React, { useState, useMemo } from "react";
import { mockDocuments } from "../../lib/data";
import { DocumentStatus } from "../../types/document";
import AppShell from "../../responsive/AppShell";
import DocumentFilters from "../../components/DocumentFilters";
import StatusBadge from "../../components/status-badge";
import RiskScore from "../../components/risk-score";
import type { FilterState } from "../../components/DocumentFilters/DocumentFilters";

export default function DocumentsPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "ALL",
    dateFrom: "",
    dateTo: "",
  });
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const filtered = useMemo(() => {
    return mockDocuments.filter((doc) => {
      if (
        filters.search &&
        !doc.title.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      if (filters.status !== "ALL" && doc.status !== filters.status.toLowerCase()) {
        return false;
      }
      if (filters.dateFrom && new Date(doc.createdAt) < new Date(filters.dateFrom)) {
        return false;
      }
      if (filters.dateTo && new Date(doc.createdAt) > new Date(filters.dateTo + "T23:59:59")) {
        return false;
      }
      return true;
    });
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <AppShell userName="John Kamau" userInitials="JK">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Documents
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage and review all your uploaded documents.
            </p>
          </div>
          <a
            href="/upload"
            className="inline-flex items-center justify-center min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
          >
            Upload Document
          </a>
        </div>

        {/* Filters */}
        <div className="mt-6">
          <DocumentFilters onChange={(f) => { setFilters(f); setPage(1); }} />
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-muted-foreground">
          {filtered.length} document{filtered.length !== 1 ? "s" : ""} found
        </div>

        {/* Document list */}
        <div className="mt-4">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <svg
                  className="h-8 w-8 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                No documents found
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or upload a new document.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginated.map((doc) => (
                <a
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="block rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50 active:bg-muted min-h-[44px]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {doc.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Owner: {doc.ownerName}</span>
                        <span>
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <RiskScore score={doc.riskScore} />
                      <StatusBadge status={doc.status} />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted active:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground px-2">
              {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted active:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
