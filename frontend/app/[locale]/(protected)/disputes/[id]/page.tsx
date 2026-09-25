"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useDateFormatting } from "@/i18n/formatting";
import { request } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

type DisputeStatus = "open" | "in_review" | "resolved" | "dismissed";

type DisputeReason = {
  id: string;
  name: string;
};

type Dispute = {
  id: string;
  documentId: string;
  description: string;
  reason: DisputeReason | null;
  status: DisputeStatus;
  filedBy: string;
  createdAt: string;
};

type User = {
  id: string;
  role: "user" | "admin";
};

const STATUS_CLASSES: Record<DisputeStatus, string> = {
  open: "bg-blue-100 text-blue-800",
  in_review: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-red-100 text-red-800",
};

const NEXT_STATUSES: Record<DisputeStatus, DisputeStatus[]> = {
  open: ["in_review", "dismissed"],
  in_review: ["resolved", "dismissed"],
  resolved: [],
  dismissed: [],
};

function formatStatus(status: DisputeStatus): string {
  return status.replace("_", " ");
}

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const disputeId = params.id;
  const { toast } = useToast();
  const { formatDate } = useDateFormatting();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<DisputeStatus>("open");

  const fetchDispute = useCallback(async () => {
    if (!disputeId) return;

    setLoading(true);
    setError(null);
    try {
      const [disputeData, userData] = await Promise.all([
        request<Dispute>(`/disputes/${disputeId}`),
        request<User>("/auth/me"),
      ]);
      setDispute(disputeData);
      setAdminStatus(disputeData.status);
      setUser(userData);
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
    if (!disputeId || !dispute || !user || user.role !== "admin") return;

    try {
      await request(`/disputes/${disputeId}/status`, {
        method: "PATCH",
        body: { status: adminStatus },
      });
      toast({
        title: "Dispute updated",
        description: "The dispute status has been updated.",
      });
      await fetchDispute();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update the dispute.",
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
        <p className="text-sm text-red-600" role="alert">
          {error ?? "Dispute not found."}
        </p>
        <Link href="/disputes" className="mt-3 block text-sm text-blue-600 underline">
          Back to disputes
        </Link>
      </main>
    );
  }

  const allowedAdminStatuses = NEXT_STATUSES[dispute.status];
  const canUpdate = user?.role === "admin" && allowedAdminStatuses.length > 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/disputes" className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700">
        ← Back to disputes
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Dispute #{dispute.id.substring(0, 8)}
        </h1>
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${STATUS_CLASSES[dispute.status]}`}>
          {formatStatus(dispute.status)}
        </span>
      </div>
      <p className="text-sm text-gray-500">
        Filed on {dispute.createdAt ? formatDate(dispute.createdAt) : "—"}
      </p>

      <div className="mt-6 space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Disputed document</h2>
          <p className="mt-2 text-sm text-gray-700">
            <Link href={`/documents/${dispute.documentId}`} className="text-blue-600 hover:underline">
              {dispute.documentId}
            </Link>
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Reason for dispute</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
            {dispute.description}
          </p>
          {dispute.reason && (
            <p className="mt-2 text-xs text-gray-500">
              Classified as: {dispute.reason.name}
            </p>
          )}
        </section>

        {canUpdate && (
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-blue-900">Admin controls</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="admin-status" className="block text-sm font-medium text-gray-700">
                  Update status
                </label>
                <select
                  id="admin-status"
                  value={adminStatus}
                  onChange={(event) => setAdminStatus(event.target.value as DisputeStatus)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  {allowedAdminStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAdminUpdate}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save status
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
