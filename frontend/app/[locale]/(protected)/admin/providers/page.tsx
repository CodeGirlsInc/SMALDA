"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  IdCard,
  Landmark,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types matching the backend ValidationType enum + provider health/stats
// ---------------------------------------------------------------------------

type ProviderId = "LAND_REGISTRY" | "GOVERNMENT_ID" | "BUSINESS_REGISTRATION";
type ProviderStatus = "online" | "degraded" | "offline";

interface ProviderStat {
  status: ProviderStatus;
  lastCheckedAt: string | null;
  successRate: number | null; // percentage, last 24h
  avgResponseTimeMs: number | null;
}

type StatsMap = Partial<Record<ProviderId, ProviderStat>>;

const PROVIDERS: { id: ProviderId; label: string; icon: LucideIcon }[] = [
  { id: "LAND_REGISTRY", label: "Land Registry", icon: Landmark },
  { id: "GOVERNMENT_ID", label: "Government ID", icon: IdCard },
  { id: "BUSINESS_REGISTRATION", label: "Business Registration", icon: Building2 },
];

const REFRESH_INTERVAL_SECONDS = 60;

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

function parseStatus(raw: unknown): ProviderStatus {
  if (typeof raw === "boolean") return raw ? "online" : "offline";
  if (typeof raw === "string") {
    const s = raw.toLowerCase();
    if (s === "online" || s === "healthy") return "online";
    if (s === "degraded") return "degraded";
  }
  return "offline";
}

function normalizeStatsEntry(raw: Record<string, unknown>): ProviderStat {
  return {
    status: parseStatus(raw.status ?? raw.healthy ?? raw.isHealthy),
    lastCheckedAt:
      typeof raw.lastCheckedAt === "string"
        ? raw.lastCheckedAt
        : typeof raw.checkedAt === "string"
          ? raw.checkedAt
          : null,
    successRate:
      typeof raw.successRate === "number"
        ? raw.successRate
        : typeof raw.successRate24h === "number"
          ? raw.successRate24h
          : null,
    avgResponseTimeMs:
      typeof raw.avgResponseTimeMs === "number"
        ? raw.avgResponseTimeMs
        : typeof raw.avgResponseTime === "number"
          ? raw.avgResponseTime
          : null,
  };
}

function providerIdFromEntry(raw: Record<string, unknown>): ProviderId | null {
  const candidate = raw.provider ?? raw.validationType ?? raw.type ?? raw.id;
  return typeof candidate === "string" && PROVIDERS.some((p) => p.id === candidate)
    ? (candidate as ProviderId)
    : null;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never checked";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never checked";

  const diffSeconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSeconds < 60) return "Checked just now";
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60)
    return `Checked ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24)
    return `Checked ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `Checked ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

const STATUS_META: Record<
  ProviderStatus,
  { label: string; icon: LucideIcon; cardBorder: string; badge: string; iconColor: string }
> = {
  online: {
    label: "Online",
    icon: CheckCircle2,
    cardBorder: "border-l-4 border-l-green-500",
    badge: "bg-green-100 text-green-800",
    iconColor: "text-green-600",
  },
  degraded: {
    label: "Degraded",
    icon: AlertTriangle,
    cardBorder: "border-l-4 border-l-yellow-500",
    badge: "bg-yellow-100 text-yellow-800",
    iconColor: "text-yellow-600",
  },
  offline: {
    label: "Offline",
    icon: XCircle,
    cardBorder: "border-l-4 border-l-red-500",
    badge: "bg-red-100 text-red-800",
    iconColor: "text-red-600",
  },
};

// ---------------------------------------------------------------------------
// Provider card
// ---------------------------------------------------------------------------

interface ProviderCardProps {
  id: ProviderId;
  label: string;
  icon: LucideIcon;
  stat: ProviderStat | undefined;
  checking: boolean;
  checkError: string | null;
  onCheckNow: (id: ProviderId) => void;
}

function ProviderCard({
  id,
  label,
  icon: ProviderIcon,
  stat,
  checking,
  checkError,
  onCheckNow,
}: ProviderCardProps) {
  const status = stat?.status ?? "offline";
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-5 space-y-4 ${meta.cardBorder}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <ProviderIcon className="h-6 w-6 text-gray-500" aria-hidden="true" />
          <h2 className="font-semibold text-gray-900">{label}</h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.badge}`}
        >
          <StatusIcon className={`h-3.5 w-3.5 ${meta.iconColor}`} aria-hidden="true" />
          {meta.label}
        </span>
      </div>

      {status === "offline" && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          This provider is unreachable. Documents may stall in external validation.
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-gray-500">Success rate (24h)</dt>
          <dd className="font-medium text-gray-900">
            {stat?.successRate != null ? `${stat.successRate.toFixed(0)}% success` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Avg. response time</dt>
          <dd className="font-medium text-gray-900">
            {stat?.avgResponseTimeMs != null ? `${Math.round(stat.avgResponseTimeMs)}ms` : "—"}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-gray-500">{formatRelativeTime(stat?.lastCheckedAt ?? null)}</p>

      {checkError && (
        <p className="text-xs text-red-600" role="alert">
          {checkError}
        </p>
      )}

      <button
        onClick={() => onCheckNow(id)}
        disabled={checking}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} aria-hidden="true" />
        {checking ? "Checking…" : "Run health check now"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProviderCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        <div className="h-5 w-16 bg-gray-200 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-8 bg-gray-100 rounded" />
        <div className="h-8 bg-gray-100 rounded" />
      </div>
      <div className="h-3 w-24 bg-gray-100 rounded" />
      <div className="h-9 bg-gray-100 rounded" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminProvidersPage() {
  const router = useRouter();

  const [statsMap, setStatsMap] = useState<StatsMap>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<Partial<Record<ProviderId, boolean>>>({});
  const [checkErrors, setCheckErrors] = useState<Partial<Record<ProviderId, string | null>>>({});
  const [secondsToRefresh, setSecondsToRefresh] = useState(REFRESH_INTERVAL_SECONDS);

  // ── Admin access check ──────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem("auth-token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload?.role !== "admin") {
        router.replace("/dashboard");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  // ── Fetch stats ──────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/external-validation/stats`, {
        headers: getAuthHeaders(),
      });
      if (res.status === 403) {
        router.replace("/dashboard");
        return;
      }
      if (!res.ok) throw new Error(`Failed to load provider stats: ${res.status}`);

      const json: unknown = await res.json();
      const entries = Array.isArray(json) ? json : [];

      setStatsMap((prev) => {
        const next: StatsMap = { ...prev };
        for (const entry of entries) {
          if (!entry || typeof entry !== "object") continue;
          const raw = entry as Record<string, unknown>;
          const id = providerIdFromEntry(raw);
          if (!id) continue;
          next[id] = normalizeStatsEntry(raw);
        }
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load provider stats");
    } finally {
      setInitialLoading(false);
    }
  }, [router]);

  // ── Auto-refresh every 60s, with visible countdown ─────────────────────

  const fetchStatsRef = useRef(fetchStats);
  fetchStatsRef.current = fetchStats;

  useEffect(() => {
    fetchStatsRef.current();

    const tick = setInterval(() => {
      setSecondsToRefresh((prev) => {
        if (prev <= 1) {
          fetchStatsRef.current();
          return REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, []);

  // ── Run health check now ────────────────────────────────────────────────

  async function handleCheckNow(id: ProviderId) {
    setChecking((prev) => ({ ...prev, [id]: true }));
    setCheckErrors((prev) => ({ ...prev, [id]: null }));

    try {
      const res = await fetch(`${API_BASE}/api/external-validation/health`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`);

      const json: unknown = await res.json();
      const checkedAt = new Date().toISOString();

      setStatsMap((prev) => {
        const next: StatsMap = { ...prev };

        if (json && typeof json === "object" && !Array.isArray(json)) {
          // Record<providerId, boolean> shape returned by the shared health check
          for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
            if (!PROVIDERS.some((p) => p.id === key)) continue;
            const providerId = key as ProviderId;
            next[providerId] = {
              ...(next[providerId] ?? {
                successRate: null,
                avgResponseTimeMs: null,
                lastCheckedAt: null,
                status: "offline",
              }),
              status: parseStatus(value),
              lastCheckedAt: checkedAt,
            };
          }
        } else {
          // Fallback: assume the response reflects only the requested provider
          next[id] = {
            ...(next[id] ?? {
              successRate: null,
              avgResponseTimeMs: null,
              lastCheckedAt: null,
              status: "offline",
            }),
            status: parseStatus(json),
            lastCheckedAt: checkedAt,
          };
        }

        return next;
      });
    } catch (err: unknown) {
      setCheckErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Health check failed",
      }));
    } finally {
      setChecking((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Validation Providers</h1>
        <p className="text-sm text-gray-500" aria-live="polite">
          Refreshing in {secondsToRefresh}s
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {initialLoading ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          role="status"
          aria-label="Loading provider health"
        >
          {PROVIDERS.map((p) => (
            <ProviderCardSkeleton key={p.id} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDERS.map((p) => (
            <ProviderCard
              key={p.id}
              id={p.id}
              label={p.label}
              icon={p.icon}
              stat={statsMap[p.id]}
              checking={checking[p.id] ?? false}
              checkError={checkErrors[p.id] ?? null}
              onCheckNow={handleCheckNow}
            />
          ))}
        </div>
      )}
    </main>
  );
}
