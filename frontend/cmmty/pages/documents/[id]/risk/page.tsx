"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  FileText,
} from "lucide-react";
import { jsPDF } from "jspdf";
import {
  RISK_FLAG_DESCRIPTIONS,
  RISK_FLAG_REMEDIATIONS,
} from "../../../../types/document";
import {
  getDocumentById,
  formatFlagName,
  getFlagContribution,
  getRiskLevel,
  formatDateTime,
} from "../../../../lib/data";
import StatusBadge from "../../../../components/status-badge";

export default function RiskAssessmentPage() {
  const params = useParams();
  const id = params?.id as string;
  const document = id ? getDocumentById(id) : undefined;
  const [downloading, setDownloading] = useState(false);

  if (!document) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <a
            href="/documents"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to documents
          </a>
          <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
            <ShieldAlert className="h-12 w-12 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">
              Document not found
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The document you are looking for does not exist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const score = document.riskScore ?? 0;
  const riskLevel = getRiskLevel(score);
  const flags = document.riskFlags || [];

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.text("Risk Assessment Report", 14, 20);

      doc.setFontSize(12);
      doc.text(`Document: ${document.title}`, 14, 30);
      doc.text(`ID: ${document.id}`, 14, 36);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 42);

      doc.setFontSize(14);
      doc.text(`Overall Risk Score: ${score} / 100`, 14, 54);
      doc.text(`Risk Level: ${riskLevel.label}`, 14, 62);

      let y = 75;
      doc.setFontSize(14);
      doc.text("Detected Flags:", 14, y);
      y += 8;

      if (flags.length > 0) {
        flags.forEach((flag) => {
          const contribution = getFlagContribution(flag, flags, score);
          doc.setFontSize(11);
          doc.text(
            `${formatFlagName(flag)} (Contribution: ${contribution})`,
            14,
            y,
          );
          y += 6;
          doc.setFontSize(10);
          const desc = RISK_FLAG_DESCRIPTIONS[flag] || "";
          doc.text(desc, 14, y);
          y += 6;
          const remediation = RISK_FLAG_REMEDIATIONS[flag] || "";
          doc.text(`Remediation: ${remediation}`, 14, y);
          y += 10;

          if (y > 280) {
            doc.addPage();
            y = 20;
          }
        });
      } else {
        doc.setFontSize(11);
        doc.text("No risk flags detected.", 14, y);
      }

      doc.save(`risk-report-${document.id}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Back link */}
        <a
          href={`/documents/${document.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to document
        </a>

        {/* Header */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Risk Assessment
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {document.title} · Document ID: {document.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={document.status} />
          </div>
        </div>

        {/* Overall Score Card */}
        <div className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex flex-col items-center sm:items-start">
              <h2 className="text-lg font-semibold text-foreground">
                Overall Risk Score
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Assessed on {formatDateTime(document.updatedAt)}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${riskLevel.bgClass} ${riskLevel.colorClass}`}
                >
                  {riskLevel.label}
                </span>
              </div>
            </div>
            <div
              className={`flex h-32 w-32 items-center justify-center rounded-full border-4 ${score > 60 ? "border-rose-500" : score >= 30 ? "border-amber-500" : "border-emerald-500"}`}
            >
              <div className="text-center">
                <span className="block text-4xl font-bold text-foreground">
                  {score}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Flags Breakdown */}
        <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Score Breakdown
            </h2>
          </div>

          {flags.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {flags.map((flag) => {
                const contribution = getFlagContribution(flag, flags, score);
                const barWidth = Math.min(contribution, 100);
                return (
                  <li
                    key={flag}
                    className="rounded-md border border-border bg-background p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {formatFlagName(flag)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {RISK_FLAG_DESCRIPTIONS[flag] ||
                            "No additional details available."}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        +{contribution}
                      </span>
                    </div>

                    {/* Contribution bar */}
                    <div className="mt-3">
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${score > 60 ? "bg-rose-500" : score >= 30 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Contribution: {contribution} points
                      </p>
                    </div>

                    {/* Remediation */}
                    <div className="mt-3 rounded-md bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Remediation
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {RISK_FLAG_REMEDIATIONS[flag] ||
                          "No remediation suggestion available."}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                No risk flags detected for this document.
              </p>
            </div>
          )}
        </div>

        {/* Download Report */}
        <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Report
                </h2>
                <p className="text-sm text-muted-foreground">
                  Download a PDF summary of this risk assessment.
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadReport}
              disabled={downloading}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {downloading ? (
                <>
                  <Download className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
