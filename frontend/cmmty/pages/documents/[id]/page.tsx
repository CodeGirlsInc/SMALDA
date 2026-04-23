"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Calendar,
  HardDrive,
  FileType,
  User,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Link,
} from "lucide-react";
import {
  DocumentStatus,
  RISK_FLAG_DESCRIPTIONS,
} from "../../../types/document";
import {
  getDocumentById,
  formatFileSize,
  formatDateTime,
} from "../../../lib/data";
import StatusBadge from "../../../components/status-badge";
import RiskGauge from "../../../components/risk-gauge";

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const document = id ? getDocumentById(id) : undefined;

  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!document) return;
    setVerifying(true);
    setVerifyMessage(null);

    // Simulate verification API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setVerifying(false);
    setVerifyMessage("Verification request submitted successfully.");
  };

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
            <XCircle className="h-12 w-12 text-muted-foreground" />
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

  const isVerified = document.status === DocumentStatus.VERIFIED;
  const canVerify =
    document.status === DocumentStatus.PENDING ||
    document.status === DocumentStatus.FLAGGED;

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Back link */}
        <a
          href="/documents"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to documents
        </a>

        {/* Header */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {document.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Document ID: {document.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={document.status} />
          </div>
        </div>

        {/* Main Content */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - Metadata */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metadata Card */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">
                Document Information
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Upload Date
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {formatDateTime(document.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      File Size
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {formatFileSize(document.fileSize)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <FileType className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      MIME Type
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {document.mimeType}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Owner
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {document.ownerName}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Flags Card */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-foreground">
                  Detected Risk Flags
                </h2>
              </div>

              {document.riskFlags && document.riskFlags.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {document.riskFlags.map((flag) => (
                    <li
                      key={flag}
                      className="flex items-start gap-3 rounded-md border border-border bg-background p-4"
                    >
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {flag
                            .split("_")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1),
                            )
                            .join(" ")}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {RISK_FLAG_DESCRIPTIONS[flag] ||
                            "No additional details available for this flag."}
                        </p>
                      </div>
                    </li>
                  ))}
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
          </div>

          {/* Right Column - Risk & Verification */}
          <div className="space-y-6">
            {/* Risk Score Card */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">
                Risk Assessment
              </h2>
              <div className="mt-4 flex justify-center">
                <RiskGauge score={document.riskScore} />
              </div>
            </div>

            {/* Verification Card */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-foreground">
                  Verification
                </h2>
              </div>

              {isVerified && document.stellarTxHash ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-semibold">
                      Verified on Stellar
                    </span>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Transaction Hash
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Link className="h-3 w-3 text-muted-foreground" />
                      <code className="break-all text-xs text-foreground">
                        {document.stellarTxHash}
                      </code>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    This document has not been verified on the Stellar
                    blockchain yet.
                  </p>

                  {canVerify && (
                    <button
                      onClick={handleVerify}
                      disabled={verifying}
                      className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Verify Document
                        </>
                      )}
                    </button>
                  )}

                  {document.status === DocumentStatus.REJECTED && (
                    <div className="flex items-center gap-2 rounded-md bg-rose-50 p-3 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        This document has been rejected and cannot be verified.
                      </span>
                    </div>
                  )}

                  {document.status === DocumentStatus.ANALYZING && (
                    <div className="flex items-center gap-2 rounded-md bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-medium">
                        Analysis in progress. Verification available after
                        review.
                      </span>
                    </div>
                  )}

                  {verifyMessage && (
                    <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {verifyMessage}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* File Info Card */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">File</h2>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground">File Path</p>
                <code className="block break-all rounded-md bg-muted p-2 text-xs text-foreground">
                  {document.filePath}
                </code>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">File Hash</p>
                <code className="block break-all rounded-md bg-muted p-2 text-xs text-foreground">
                  {document.fileHash}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
