"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { ApiError, request } from "@/lib/api-client";
import { API_PREFIX } from "@/lib/api-contracts";
import {
  disputeStatusValues,
  type DisputeResponse,
  type DisputeStatus,
} from "@/lib/schemas/dispute";
import { useToast } from "@/components/ui/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Dispute extends DisputeResponse {
  timeline?: { status: DisputeStatus; createdAt: string }[];
  resolution?: string | null;
  resolvedAt?: string | null;
  document?: {
    title?: string;
    status?: string;
    riskScore?: number;
  } | null;
}

interface User {
  id: string;
  role: "user" | "admin";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<DisputeStatus, string> = {
  open: "bg-blue-100 text-blue-800",
  in_review: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-red-100 text-red-800",
};

// Withdrawal stays hidden until the backend exposes DELETE /disputes/:id (#1524).
const WITHDRAW_DISPUTE_ENABLED = false;

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You do not have permission to perform this action.";
    if (err.status === 404) return "Dispute not found.";
    if (err.kind === "validation") return "Please check the submitted information.";
    if (err.kind === "network") return "Network error. Please try again.";
    return fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const disputeId = params.id;
  const router = useRouter();
  const { toast } = useToast();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<DisputeStatus>("open");
  const [adminResolution, setAdminResolution] = useState("");

  const fetchDispute = useCallback(async () => {
    if (!disputeId) return;
    setLoading(true);
    setError(null);
    try {
      const disputeData = await request<Dispute>(
        `${API_PREFIX}/disputes/${disputeId}`,
      );
      setDispute(disputeData);
      setAdminStatus(disputeData.status ?? "open");
      try {
        const userData = await request<User>(`${API_PREFIX}/auth/me`);
        setUser(userData);
      } catch {
        setUser(null);
      }
    } catch (err) {
      setError(describeError(err, "Failed to load dispute."));
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  const handleWithdrawDispute = async () => {
    if (!disputeId) return;
    try {
      await request(`${API_PREFIX}/disputes/${disputeId}`, {
        method: "DELETE",
      });
      toast({
        title: "Dispute Withdrawn",
        description: "The dispute has been successfully withdrawn.",
      });
      router.push("/disputes");
    } catch (err) {
      toast({
        title: "Error",
        description: describeError(err, "Failed to withdraw the dispute."),
        variant: "destructive",
      });
    }
  };

  const handleAdminUpdate = async () => {
    if (!disputeId) return;
    try {
      await request(`${API_PREFIX}/disputes/${disputeId}/status`, {
        method: "PATCH",
        body: { status: adminStatus, resolution: adminResolution },
      });
      toast({
        title: "Dispute Updated",
        description: "The dispute has been successfully updated.",
      });
      router.push("/disputes");
    } catch (err) {
      toast({
        title: "Error",
        description: describeError(err, "Failed to update the dispute."),
        variant: "destructive",
      });
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
        <p className="text-sm text-red-600">{error ?? "Dispute not found."}</p>
        <Link
          href="/disputes"
          className="mt-3 block text-sm text-blue-600 underline"
        >
          Back to disputes
        </Link>
      </main>
    );
  }

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
          className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
            STATUS_CLASSES[dispute.status] ?? "bg-gray-100 text-gray-800"
          }`}
        >
          {dispute.status?.replace("_", " ")}
        </span>
      </div>
      <p className="text-sm text-gray-500">
        Filed on {new Date(dispute.createdAt).toLocaleDateString()}
      </p>

      <div className="mt-6 space-y-6">
        {dispute.document && (
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">
              Disputed Document
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              <Link
                href={`/documents/${dispute.documentId}`}
                className="text-blue-600 hover:underline"
              >
                {dispute.document.title ?? dispute.documentId}
              </Link>
            </p>
            <div className="mt-2 flex space-x-4 text-xs">
              <span>Status: {dispute.document.status ?? "—"}</span>
              {dispute.document.riskScore != null && (
                <span>Risk Score: {dispute.document.riskScore}%</span>
              )}
            </div>
          </section>
        )}

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

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Status Timeline
          </h2>
          {dispute.timeline?.length ? (
            <ol className="mt-4 space-y-4">
              {dispute.timeline.map((event, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      index === (dispute.timeline?.length ?? 0) - 1
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {event.status?.replace("_", " ")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No timeline available.</p>
          )}
        </section>

        {(dispute.status === "resolved" || dispute.status === "dismissed") &&
          dispute.resolution && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">
                Resolution
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
                {dispute.resolution}
              </p>
              {dispute.resolvedAt && (
                <p className="mt-2 text-xs text-gray-500">
                  Resolved on {new Date(dispute.resolvedAt).toLocaleDateString()}
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
                  onChange={(e) =>
                    setAdminStatus(e.target.value as DisputeStatus)
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  {disputeStatusValues.map((status) => (
                    <option key={status} value={status}>
                      {status.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="admin-resolution"
                  className="block text-sm font-medium text-gray-700"
                >
                  Resolution Notes
                </label>
                <textarea
                  id="admin-resolution"
                  rows={4}
                  value={adminResolution}
                  onChange={(e) => setAdminResolution(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <button
                onClick={handleAdminUpdate}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </section>
        )}

        {WITHDRAW_DISPUTE_ENABLED && dispute.status === "open" && user?.id === dispute.filedBy && (
          <div className="mt-6">
            <button
              onClick={handleWithdrawDispute}
              className="text-sm text-red-600 hover:underline"
            >
              Withdraw Dispute
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
