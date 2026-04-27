"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { DocumentStatus } from "../../types/document";
import AppShell from "../../responsive/AppShell";
import { useAuth } from "../../context/AuthContext/AuthContext";
import {
  fetchDashboardData,
  DashboardData,
  DashboardStats,
} from "../../lib/api/dashboard";

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!isAuthenticated) return;

      try {
        setLoading(true);
        setError(null);
        const data = await fetchDashboardData();
        setDashboardData(data);
      } catch (err: any) {
        console.error("Failed to load dashboard data:", err);
        setError(err?.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [isAuthenticated]);

  const stats: DashboardStats = dashboardData?.stats || {
    totalDocuments: 0,
    verifiedDocuments: 0,
    flaggedDocuments: 0,
    pendingDocuments: 0,
    avgRiskScore: 0,
  };

  const recentDocs = dashboardData?.recentDocuments || [];

  const userName = user?.name || "User";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AppShell userName={userName} userInitials={userInitials}>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {/* Welcome Message */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {userName}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's an overview of your documents and risk assessments.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span className="ml-3 text-sm text-muted-foreground">
              Loading dashboard...
            </span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                Error Loading Dashboard
              </h3>
            </div>
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 rounded-md bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900 min-h-[44px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && (
          <>
            {/* Stat cards */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-blue-50 p-2 dark:bg-blue-950/30">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Total Documents
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">
                      {stats.totalDocuments}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-emerald-50 p-2 dark:bg-emerald-950/30">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Verified
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">
                      {stats.verifiedDocuments}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-rose-50 p-2 dark:bg-rose-950/30">
                    <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Flagged
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">
                      {stats.flaggedDocuments}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-amber-50 p-2 dark:bg-amber-950/30">
                    <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Avg Risk Score
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">
                      {stats.avgRiskScore}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Recent Documents
                </h2>
                <a
                  href="/documents"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500 min-h-[44px] flex items-center"
                >
                  View all
                </a>
              </div>

              {recentDocs.length === 0 ? (
                <div className="mt-4 rounded-lg border border-border bg-card p-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-sm font-medium text-foreground">
                    No documents yet
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upload your first document to get started.
                  </p>
                  <a
                    href="/upload"
                    className="mt-4 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 min-h-[44px]"
                  >
                    Upload Document
                  </a>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentDocs.map((doc) => (
                    <a
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="block rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50 active:bg-muted min-h-[44px]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="rounded-md bg-muted p-2 shrink-0">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {doc.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                Risk: {doc.riskScore ?? 0}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            doc.status === DocumentStatus.VERIFIED
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : doc.status === DocumentStatus.FLAGGED
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                                : doc.status === DocumentStatus.PENDING
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                  : doc.status === DocumentStatus.ANALYZING
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                    : "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Pending review section */}
            {stats.pendingDocuments > 0 && (
              <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    {stats.pendingDocuments} document
                    {stats.pendingDocuments > 1 ? "s" : ""} pending review
                  </h3>
                </div>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  These documents are awaiting analysis and verification.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
