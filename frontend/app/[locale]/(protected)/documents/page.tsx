"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useDateFormatting } from "@/i18n/formatting";
import { request } from "@/lib/api-client";
import { apiUrl } from "@/lib/api-config";

type DocumentStatus =
  | "pending"
  | "analyzing"
  | "verified"
  | "flagged"
  | "rejected";
type StatusFilter = "all" | DocumentStatus;

interface DocumentItem {
  id: string;
  title: string;
  status: DocumentStatus;
  riskScore: number | null;
  riskFlags: string[] | null;
  createdAt: string;
  updatedAt: string;
  fileSize?: number;
}

interface PaginatedDocuments {
  documents: DocumentItem[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 5;
const MAX_DOCUMENT_LIMIT = 100;
const MAX_DOCUMENT_PAGE = 10000;
const DOCUMENT_STATUSES: DocumentStatus[] = [
  "pending",
  "analyzing",
  "verified",
  "flagged",
  "rejected",
];

const STATUS_BADGE_CLASSES: Record<DocumentStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  analyzing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  verified: "bg-green-500/10 text-green-400 border-green-500/30",
  flagged: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStatus(value: unknown): DocumentStatus {
  const status = typeof value === "string" ? value.toLowerCase() : "";
  return DOCUMENT_STATUSES.includes(status as DocumentStatus)
    ? (status as DocumentStatus)
    : "pending";
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseDocumentsResponse(payload: unknown): PaginatedDocuments {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("Invalid documents response");
  }

  const documents = payload.data.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.title !== "string"
    ) {
      throw new Error("Invalid document response");
    }

    return {
      id: item.id,
      title: item.title,
      status: normalizeStatus(item.status),
      riskScore: toNullableNumber(item.riskScore),
      riskFlags: Array.isArray(item.riskFlags)
        ? item.riskFlags.filter((flag): flag is string => typeof flag === "string")
        : null,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
      fileSize: toNullableNumber(item.fileSize) ?? undefined,
    } satisfies DocumentItem;
  });

  return {
    documents,
    total:
      typeof payload.total === "number" && Number.isFinite(payload.total)
        ? payload.total
        : documents.length,
    page: Math.min(
      MAX_DOCUMENT_PAGE,
      Math.max(
        1,
        typeof payload.page === "number" && Number.isFinite(payload.page)
          ? payload.page
          : 1,
      ),
    ),
    limit: Math.min(
      MAX_DOCUMENT_LIMIT,
      Math.max(
        1,
        typeof payload.limit === "number" && Number.isFinite(payload.limit)
          ? payload.limit
          : PAGE_SIZE,
      ),
    ),
  };
}

function formatFileSize(
  value: number | undefined,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
  if (value == null || value < 0) return "—";
  if (value < 1024) return `${formatNumber(value)} B`;
  if (value < 1024 * 1024) {
    return `${formatNumber(value / 1024, { maximumFractionDigits: 1 })} KB`;
  }
  return `${formatNumber(value / (1024 * 1024), { maximumFractionDigits: 1 })} MB`;
}

export default function DocumentsListPage() {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const { formatDate, formatNumber } = useDateFormatting();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const fetchDocuments = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setDocuments([]);
      setTotal(0);

      const requestedPage = Math.min(
        MAX_DOCUMENT_PAGE,
        Math.max(1, currentPage),
      );
      const params = new URLSearchParams({
        page: String(requestedPage),
        limit: String(PAGE_SIZE),
      });
      const search = searchQuery.trim();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      try {
        const payload = await request<unknown>(
          apiUrl("/documents", params),
          { signal },
        );
        if (signal?.aborted) return;

        const result = parseDocumentsResponse(payload);
        const lastPage = Math.max(1, Math.ceil(result.total / result.limit));
        if (result.page !== currentPage) {
          setCurrentPage(result.page);
          return;
        }
        if (result.total > 0 && currentPage > lastPage) {
          setCurrentPage(lastPage);
          return;
        }

        setDocuments(result.documents);
        setTotal(result.total);
        setPageSize(result.limit);
      } catch {
        if (signal?.aborted) return;
        setError(t("loadError"));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentPage, searchQuery, statusFilter, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchDocuments(controller.signal);
    return () => controller.abort();
  }, [fetchDocuments]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastResult = total === 0 ? 0 : Math.min(currentPage * pageSize, total);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-white">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-xs text-gray-400">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/documents/upload"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500"
        >
          {t("upload")}
        </Link>
      </div>

      <section
        aria-label={t("filters.legend")}
        className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-800 bg-gray-950 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="w-full sm:w-72">
          <label htmlFor="document-search" className="sr-only">
            {t("search.label")}
          </label>
          <input
            id="document-search"
            type="search"
            maxLength={100}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder={t("search.placeholder")}
            className="w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          <label htmlFor="document-status" className="text-xs text-gray-400">
            {t("filters.status")}
          </label>
          <select
            id="document-status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setCurrentPage(1);
            }}
            className="rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">{t("filters.allStatuses")}</option>
            {DOCUMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div
        className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-xl"
        aria-busy={loading}
      >
        {loading ? (
          <div className="flex flex-col items-center py-12" role="status">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
              aria-hidden="true"
            />
            <p className="mt-3 text-xs text-gray-400">{t("loading")}</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center" role="alert">
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => void fetchDocuments()}
              className="mt-3 text-sm font-medium text-blue-400 underline hover:no-underline"
            >
              {tErrors("tryAgain")}
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            {t("empty")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="border-b border-gray-800 bg-gray-900 text-xs font-semibold text-gray-400">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    {t("table.name")}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {t("table.status")}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {t("table.fileSize")}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {t("table.uploaded")}
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    {t("table.action")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {documents.map((document) => (
                  <tr key={document.id} className="hover:bg-gray-900/50">
                    <td className="px-6 py-4 font-medium text-white">
                      <Link
                        href={`/documents/${document.id}`}
                        className="hover:underline"
                      >
                        {document.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_BADGE_CLASSES[document.status]
                        }`}
                      >
                        {t(`status.${document.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {formatFileSize(document.fileSize, formatNumber)}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {document.createdAt ? formatDate(document.createdAt) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/documents/${document.id}`}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300"
                      >
                        {t("table.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <nav
            aria-label={t("pagination.label")}
            className="flex items-center justify-between border-t border-gray-800 px-6 py-4"
          >
            <span className="text-xs text-gray-400" aria-live="polite">
              {t("pagination.summary", {
                from: firstResult,
                to: lastResult,
                total,
              })}
            </span>
            <div className="flex space-x-2">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="rounded-md border border-gray-800 bg-gray-900 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-40"
              >
                {tCommon("previous")}
              </button>
              <span
                aria-current="page"
                className="px-3 py-1 text-xs text-gray-400"
              >
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="rounded-md border border-gray-800 bg-gray-900 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-40"
              >
                {tCommon("next")}
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
