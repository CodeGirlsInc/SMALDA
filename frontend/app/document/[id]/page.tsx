'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { DocumentHeader } from '@/components/documents/DocumentHeader';
import { DocumentMetadata } from '@/components/documents/DocumentMetadata';
import { RiskSummary } from '@/components/documents/RiskSummary';
import { StatusTimeline } from '@/components/documents/StatusTimeline';
import { VerifyOnStellarButton } from '@/components/documents/VerifyOnStellarButton';
import { VerificationNotice } from '@/components/documents/VerificationNotice';
import { ReportLinkCard } from '@/components/documents/ReportLinkCard';
import { EmptyAnalysisState } from '@/components/documents/EmptyAnalysisState';

import { useDocument } from '@/hooks/useDocument';
import { useVerifyDocument } from '@/hooks/useVerifyDocument';

export default function DocumentDetailPage() {
  const params = useParams();

  const documentId = params.id as string;

  const {
    data: document,
    isLoading,
    isError,
    error,
    refetch,
  } = useDocument(documentId);

  const verifyMutation = useVerifyDocument(documentId);

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-64 rounded bg-muted" />

          <div className="h-44 rounded-xl bg-muted" />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-80 rounded-xl bg-muted" />
            <div className="h-80 rounded-xl bg-muted" />
          </div>

          <div className="h-48 rounded-xl bg-muted" />
        </div>
      </main>
    );
  }

  if (isError || !document) {
    return (
      <main className="container mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-bold">
          Unable to load document
        </h1>

        <p className="mt-4 text-muted-foreground">
          {error instanceof Error
            ? error.message
            : 'Something went wrong while fetching this document.'}
        </p>

        <Button
          className="mt-8"
          onClick={() => refetch()}
        >
          Try Again
        </Button>
      </main>
    );
  }

  const analysisCompleted =
    document.status === 'VERIFIED' ||
    document.status === 'FLAGGED' ||
    document.status === 'REJECTED';

  const verificationAllowed =
    document.status === 'VERIFIED';

  return (
    <main className="container mx-auto max-w-7xl px-6 py-10">

      <div className="mb-8">
        <Link
          href="/documents"
          className="text-sm text-primary hover:underline"
        >
          ← Back to Documents
        </Link>
      </div>

      <DocumentHeader
        title={document.title}
        uploadedAt={document.createdAt}
        status={document.status}
      />

      <Separator className="my-8" />

      <DocumentMetadata
        document={document}
      />

      <Separator className="my-8" />

      {analysisCompleted ? (
        <RiskSummary
          score={document.riskScore}
          flags={document.riskFlags}
        />
      ) : (
        <EmptyAnalysisState />
      )}

      <Separator className="my-8" />

      <StatusTimeline
        currentStatus={document.status}
        events={document.timeline}
      />

      <Separator className="my-8" />

      <section className="space-y-4">

        <h2 className="text-xl font-semibold">
          Blockchain Verification
        </h2>

        {verificationAllowed ? (
          <VerifyOnStellarButton
            loading={verifyMutation.isPending}
            onVerify={() =>
              verifyMutation.mutate()
            }
          />
        ) : (
          <>
            <VerifyOnStellarButton
              disabled
            />

            <VerificationNotice
              message="Verification becomes available after the document has successfully completed analysis."
            />
          </>
        )}
      </section>

      <Separator className="my-8" />

      {analysisCompleted && (
        <ReportLinkCard
          href={`/documents/${document.id}/report`}
        />
      )}
    </main>
  );
}