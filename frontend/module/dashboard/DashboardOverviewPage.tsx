"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface DocumentStatus {
  status: string;
  count: number;
}

interface RecentDocument {
  id: string;
  title: string;
  status: string;
  uploadedAt: string;
}

interface DashboardStats {
  totalDocuments: number;
  byStatus: DocumentStatus[];
  averageRiskScore: number;
  highRiskCount: number;
  recentDocuments: RecentDocument[];
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="mt-2 h-8 w-16 rounded bg-gray-200" />
    </div>
  );
}

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/module/dashboard/stats`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to load dashboard data.");
      const data: DashboardStats = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchStats}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats || stats.totalDocuments === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center">
        <p className="text-gray-500">You have no documents yet.</p>
        <Link
          href="/documents/upload"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Upload your first document
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Documents" value={stats.totalDocuments} />
        <StatCard label="Avg Risk Score" value={stats.averageRiskScore.toFixed(1)} />
        <StatCard label="High Risk" value={stats.highRiskCount} />
        {stats.byStatus.map((s) => (
          <StatCard key={s.status} label={s.status} value={s.count} />
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Recent Documents</h2>
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
          {stats.recentDocuments.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-medium text-gray-900">{doc.title}</span>
              <div className="flex items-center gap-4">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {doc.status}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
