"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { request } from "@/lib/api-client";
import {
  disputeStatusLabel,
  disputeStatuses,
  normalizeAuthUser,
  normalizeDispute,
  type AuthUser,
  type Dispute,
  type DisputeStatus,
} from "@/lib/disputes";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CLASSES: Record<DisputeStatus, string> = {
  open: "bg-blue-100 text-blue-800",
  in_review: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-red-100 text-red-800",
};

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const disputeId = params.id;
  const { toast } = useToast();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<DisputeStatus>("open");

  const fetchDispute = useCallback(async () => {
    if (!disputeId) return;
    setLoading(true);
    setError(null);
    try {
      const [disputeResponse, userResponse] = await Promise.all([
        request<unknown>(`disputes/${disputeId}`),
        request<unknown>("auth/me"),
      ]);
      const normalizedDispute = normalizeDispute(disputeResponse);
      setDispute(normalizedDispute);
      setAdminStatus(normalizedDispute.status);
      setUser(normalizeAuthUser(userResponse));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dispute.");
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    void fetchDispute();
  }, [fetchDispute]);

  const handleAdminUpdate = async () => {
    if (!disputeId || user?.role !== "admin") return;
    setUpdating(true);
    try {
      const response = await request<unknown>(
        `disputes/${disputeId}/status`,
        {
          method: "PATCH",
          body: { status: adminStatus },
        },
      );
      const updatedDispute = normalizeDispute(response);
      setDispute(updatedDispute);
      setAdminStatus(updatedDispute.status);
      toast({
        title: "Dispute Updated",
        description: "The dispute status has been successfully updated.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to update dispute status.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-gray-200" />
      </main>
    );
  }

  if (!dispute) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-red-600">
          {error ?? "Dispute not found."}
        </p>
        <Link
          href="/disputes"
          className="mt-3 block text-sm text-blue-600 underline"
        >
          Back to disputes
        </Link>
      </main>
    );
  }

  const documentStatus = dispute.document?.status;
  const documentRiskScore = dispute.document?.riskScore;
  const timeline = dispute.timeline;
  const resolution = dispute.resolution;
  const resolvedAt = dispute.resolvedAt;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/disputes"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to disputes
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Dispute #{dispute.id.substring(0, 8)}
        </h1>
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-semibold capitalize ${
            STATUS_CLASSES[dispute.status]
          }`}
        >
          {disputeStatusLabel(dispute.status)}
        </span>
      </div>
      <p className="text-sm text-gray-500">
        Filed on {new Date(dispute.createdAt).toLocaleDateString()}
      </p>

      <div className="mt-6 space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Disputed Document
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            <Link
              href={`/documents/${dispute.documentId}`}
              className="text-blue-600 hover:underline"
            >
              {dispute.document?.title ?? `Document ${dispute.documentId}`}
            </Link>
          </p>
          {(documentStatus || typeof documentRiskScore === "number") && (
            <div className="mt-2 flex space-x-4 text-xs">
              {documentStatus && <span>Status: {documentStatus}</span>}
              {typeof documentRiskScore === "number" && (
                <span>Risk Score: {documentRiskScore}%</span>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Reason for Dispute
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
            {dispute.description}
          </p>
          {dispute.reason && (
            <p className="mt-2 text-xs text-gray-500">
              Classified as: {dispute.reason.name}
            </p>
          )}
        </section>

        {timeline.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">
              Status Timeline
            </h2>
            <ol className="mt-4 space-y-4">
              {timeline.map((event, index) => (
                <li
                  key={`${event.status}-${event.createdAt}`}
                  className="flex items-start gap-3"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      index === timeline.length - 1
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium capitalize text-gray-900">
                      {disputeStatusLabel(event.status)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {(dispute.status === "resolved" || dispute.status === "dismissed") &&
          resolution && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">
                Resolution
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
                {resolution}
              </p>
              {resolvedAt && (
                <p className="mt-2 text-xs text-gray-500">
                  Resolved on {new Date(resolvedAt).toLocaleDateString()}
                </p>
              )}
            </section>
          )}

        {user?.role === "admin" && (
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-blue-900">
              Admin Controls
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="admin-status"
                  className="block text-sm font-medium text-gray-700"
                >
                  Update Status
                </label>
                <select
                  id="admin-status"
                  value={adminStatus}
                  onChange={(event) =>
                    setAdminStatus(event.target.value as DisputeStatus)
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  {disputeStatuses.map((status) => (
                    <option key={status} value={status}>
                      {disputeStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAdminUpdate}
                disabled={updating || adminStatus === dispute.status}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
