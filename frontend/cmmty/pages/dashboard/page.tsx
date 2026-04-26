"use client";

import React from "react";
import {
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { mockDocuments } from "../../lib/data";
import { DocumentStatus } from "../../types/document";
import AppShell from "../../responsive/AppShell";

export default function DashboardPage() {
  const totalDocs = mockDocuments.length;
  const verifiedDocs = mockDocuments.filter(
    (d) => d.status === DocumentStatus.VERIFIED
  ).length;
  const flaggedDocs = mockDocuments.filter(
    (d) => d.status === DocumentStatus.FLAGGED
  ).length;
  const pendingDocs = mockDocuments.filter(
    (d) => d.status === DocumentStatus.PENDING
  ).length;
  const avgRiskScore = Math.round(
    mockDocuments.reduce((sum, d) => sum + (d.riskScore ?? 0), 0) / totalDocs
  );

  const recentDocs = [...mockDocuments]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <AppShell userName="John Kamau" userInitials="JK">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your documents and risk assessments.
        </p>

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
                  {totalDocs}
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
                  {verifiedDocs}
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
                  {flaggedDocs}
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
                  {avgRiskScore}
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
        </div>

        {/* Pending review section */}
        {pendingDocs > 0 && (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {pendingDocs} document{pendingDocs > 1 ? "s" : ""} pending
                review
              </h3>
            </div>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              These documents are awaiting analysis and verification.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
