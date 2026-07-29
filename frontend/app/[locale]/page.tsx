"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";

// ---------------------------------------------------------------------------
// Types matching the backend Document entity (GET /documents response)
// ---------------------------------------------------------------------------

type DocumentStatus =
  | "pending"
  | "analyzing"
  | "verified"
  | "flagged"
  | "rejected";

interface DocumentSummary {
  id: string;
  title: string;
  status: DocumentStatus;
  riskScore: number | null;
  riskFlags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedDocuments {
  data: DocumentSummary[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_ORDER: DocumentStatus[] = [
  "pending",
  "analyzing",
  "verified",
  "flagged",
  "rejected",
];

const STATUS_BAR_COLOR: Record<DocumentStatus, string> = {
  pending: "bg-yellow-400",
  analyzing: "bg-blue-500",
  verified: "bg-green-500",
  flagged: "bg-red-500",
  rejected: "bg-gray-400",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const RECENT_LIMIT = 10;
// Max page size the API allows; used as a single-request approximation for
// the aggregate stats and risk distribution (no dedicated stats endpoint yet).
const STATS_SAMPLE_LIMIT = 100;

function statusBadgeClass(status: DocumentStatus): string {
  const base = "inline-block rounded px-2 py-0.5 text-xs font-medium";
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

function riskTextClass(score: number | null): string {
  if (score == null) return "text-gray-400";
  if (score >= 0.7) return "text-red-600";
  if (score >= 0.4) return "text-yellow-600";
  return "text-green-600";
}

interface DashboardStats {
  total: number;
  verified: number;
  flagged: number;
  averageRisk: number | null;
  statusCounts: Record<DocumentStatus, number>;
  recent: DocumentSummary[];
}

function computeStats(paginated: PaginatedDocuments): DashboardStats {
  const statusCounts = STATUS_ORDER.reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {} as Record<DocumentStatus, number>
  );

  let riskSum = 0;
  let riskCount = 0;

  for (const doc of paginated.data) {
    statusCounts[doc.status] += 1;
    if (doc.riskScore != null) {
      riskSum += doc.riskScore;
      riskCount += 1;
    }
  }

  return {
    total: paginated.total,
    verified: statusCounts.verified,
    flagged: statusCounts.flagged,
    averageRisk: riskCount > 0 ? riskSum / riskCount : null,
    statusCounts,
    recent: paginated.data.slice(0, RECENT_LIMIT),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tDocuments = useTranslations("documents");
  const tErrors = useTranslations("errors");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("auth-token")
          : null;

      const res = await fetch(
        `${API_BASE}/api/documents?page=1&limit=${STATS_SAMPLE_LIMIT}`,
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

      const json: PaginatedDocuments = await res.json();
      setStats(computeStats(json));
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = stats
    ? [
        { key: "total", value: String(stats.total) },
        { key: "verified", value: String(stats.verified) },
        { key: "flagged", value: String(stats.flagged) },
        {
          key: "averageRisk",
          value: stats.averageRisk != null ? stats.averageRisk.toFixed(2) : "—",
        },
      ]
    : [];

  return (
    <main
      aria-labelledby="dashboard-heading"
      className="mx-auto max-w-4xl px-4 py-8"
    >
      <h1 id="dashboard-heading" className="sr-only">
        {t("title")}
      </h1>
      <header className="mb-8">
        <p className="text-sm font-medium text-blue-600">{t("welcome")}</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchStats}
            className="mt-2 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {tErrors("tryAgain")}
          </button>
        </div>
      )}

      {loading && (
        <section
          aria-label={t("title")}
          aria-live="polite"
          aria-atomic="true"
          className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <Skeleton width="3rem" height="1.75rem" />
              <Skeleton className="mt-2" width="80%" height="0.75rem" />
            </div>
          ))}
        </section>
      )}

      {!loading && !error && stats && stats.total === 0 && (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Link
              href="/documents"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t("uploadDocument")}
            </Link>
          }
        />
      )}

      {!loading && !error && stats && stats.total > 0 && (
        <>
          <section
            aria-label={t("title")}
            aria-live="polite"
            aria-atomic="true"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {statCards.map((card) => (
              <div
                key={card.key}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <p className="text-2xl font-bold text-gray-900">
                  {card.value}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  {t(`stats.${card.key}`)}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-gray-900">
              {t("riskDistribution")}
            </h2>
            <div className="mt-3 space-y-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              {STATUS_ORDER.map((status) => {
                const count = stats.statusCounts[status];
                const pct =
                  stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-medium text-gray-600">
                      {tDocuments(`status.${status}`)}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${STATUS_BAR_COLOR[status]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs text-gray-500">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {t("recentDocuments")}
              </h2>
              <Link
                href="/documents"
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                {t("viewDocuments")}
              </Link>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-gray-600"
                    >
                      {tDocuments("table.name")}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-gray-600"
                    >
                      {tDocuments("table.status")}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-gray-600"
                    >
                      {tDocuments("table.riskScore")}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-gray-600"
                    >
                      {tDocuments("table.uploaded")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {stats.recent.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="hover:underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                        >
                          {doc.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(doc.status)}>
                          {tDocuments(`status.${doc.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={riskTextClass(doc.riskScore)}>
                          {doc.riskScore != null ? doc.riskScore.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-gray-900">
              {t("quickActions")}
            </h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/documents"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {t("uploadDocument")}
              </Link>
              <Link
                href="/admin/documents"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                {t("viewDocuments")}
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
