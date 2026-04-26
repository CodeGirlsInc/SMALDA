"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Clock,
  Hash,
  BookOpen,
  Link,
  ShieldAlert,
} from "lucide-react";
import { DocumentStatus } from "../../../../types/document";
import { getDocumentById, formatDateTime } from "../../../../lib/data";
import StatusBadge from "../../../../components/status-badge";

const STELLAR_TESTNET_EXPLORER =
  "https://testnet.stellar.expert/explorer/public";

export default function VerificationPage() {
  const params = useParams();
  const id = params?.id as string;
  const document = id ? getDocumentById(id) : undefined;

  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const handleTriggerVerification = async () => {
    if (!document) return;
    setTriggering(true);
    setTriggerMessage(null);

    // Simulate verification trigger
    await new Promise((resolve) => setTimeout(resolve, 2500));

    setTriggering(false);
    setTriggerMessage(
      "Verification request submitted. The document will be anchored on the Stellar blockchain shortly.",
    );
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

  const isVerified = document.status === DocumentStatus.VERIFIED;
  const canTriggerVerification =
    document.status === DocumentStatus.PENDING ||
    document.status === DocumentStatus.FLAGGED ||
    document.status === DocumentStatus.ANALYZING;
  const isRejected = document.status === DocumentStatus.REJECTED;

  const explorerTxUrl = document.stellarTxHash
    ? `${STELLAR_TESTNET_EXPLORER}/tx/${document.stellarTxHash}`
    : null;

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
              Blockchain Verification
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {document.title} · Document ID: {document.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={document.status} />
          </div>
        </div>

        {/* Verification Status Card */}
        <div className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Verification Status
            </h2>
          </div>

          {isVerified ? (
            <div className="mt-6 space-y-6">
              {/* Verified indicator */}
              <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    Verified on Stellar Blockchain
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                    This document has been cryptographically anchored and its
                    integrity can be independently verified.
                  </p>
                </div>
              </div>

              {/* Stellar details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Transaction Hash */}
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">
                      Transaction Hash
                    </p>
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <Link className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <code className="break-all text-xs text-foreground">
                      {document.stellarTxHash}
                    </code>
                  </div>
                </div>

                {/* Ledger Number */}
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">
                      Ledger Number
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {document.ledgerNumber?.toLocaleString()}
                  </p>
                </div>

                {/* Anchored Timestamp */}
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">
                      Anchored Timestamp
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {document.anchoredTimestamp
                      ? formatDateTime(document.anchoredTimestamp)
                      : "—"}
                  </p>
                </div>

                {/* File Hash */}
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">
                      Document Hash
                    </p>
                  </div>
                  <code className="mt-2 block break-all text-xs text-foreground">
                    {document.fileHash}
                  </code>
                </div>
              </div>

              {/* Explorer link */}
              {explorerTxUrl && (
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-muted sm:w-auto"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Stellar Testnet Explorer
                </a>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {/* Not verified indicator */}
              <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <Shield className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Not Yet Verified
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                    This document has not been anchored on the Stellar
                    blockchain.
                  </p>
                </div>
              </div>

              {/* Document info */}
              <div className="rounded-md border border-border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Document Hash
                </p>
                <code className="mt-1 block break-all text-xs text-foreground">
                  {document.fileHash}
                </code>
                <p className="mt-3 text-xs text-muted-foreground">
                  When verified, this hash will be permanently recorded on the
                  Stellar blockchain as immutable proof of the document&apos;s
                  existence and integrity.
                </p>
              </div>

              {/* Rejected notice */}
              {isRejected && (
                <div className="flex items-center gap-2 rounded-md bg-rose-50 p-3 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">
                    This document has been rejected and cannot be verified.
                  </span>
                </div>
              )}

              {/* Analyzing / in-progress notice */}
              {document.status === DocumentStatus.ANALYZING && (
                <div className="flex items-center gap-2 rounded-md bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="text-xs font-medium">
                    Analysis in progress. Verification will be available once
                    review is complete.
                  </span>
                </div>
              )}

              {/* Trigger Verification button */}
              {canTriggerVerification && (
                <button
                  onClick={handleTriggerVerification}
                  disabled={triggering}
                  className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {triggering ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Triggering Verification...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Trigger Verification
                    </>
                  )}
                </button>
              )}

              {/* Success message after trigger */}
              {triggerMessage && (
                <div className="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">{triggerMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* How Verification Works */}
        <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            How Verification Works
          </h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Document Hashing
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A cryptographic hash of the document is generated to create a
                  unique fingerprint.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Stellar Anchoring
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The hash is submitted as a transaction on the Stellar testnet,
                  creating an immutable record.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Independent Verification
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Anyone can verify the document&apos;s integrity by comparing
                  its hash against the on-chain record at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
