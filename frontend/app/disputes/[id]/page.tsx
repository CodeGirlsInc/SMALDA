'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

interface DisputeDetail {
  id: string;
  documentId: string;
  reason: string;
  status: string;
  resolution?: string;
  createdAt: string;
  timeline: TimelineEvent[];
}

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);

  useEffect(() => {
    fetch(`/api/disputes/${id}`)
      .then((r) => r.json())
      .then(setDispute)
      .catch(() => {});
  }, [id]);

  if (!dispute) return <p className="p-8 text-gray-500">Loading...</p>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/disputes" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        &larr; Back to Disputes
      </Link>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dispute #{dispute.id.slice(0, 8)}</h1>
          <p className="text-sm text-gray-500 mt-1">Document: {dispute.documentId}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Reason</span>
            <p className="text-gray-600 mt-1">{dispute.reason}</p>
          </div>
          <div>
            <span className="font-medium">Status</span>
            <p className="mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                dispute.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                dispute.status === 'resolved' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-600'
              }`}>{dispute.status}</span>
            </p>
          </div>
        </div>

        {dispute.resolution && (
          <div>
            <span className="font-medium text-sm">Resolution</span>
            <p className="text-gray-600 text-sm mt-1">{dispute.resolution}</p>
          </div>
        )}

        <div>
          <h2 className="font-semibold mb-3">Timeline</h2>
          {dispute.timeline.length === 0 ? (
            <p className="text-gray-400 text-sm">No events recorded.</p>
          ) : (
            <div className="space-y-3">
              {dispute.timeline.map((evt) => (
                <div key={evt.id} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />
                  <div>
                    <p className="font-medium">{evt.type}</p>
                    <p className="text-gray-600">{evt.description}</p>
                    <p className="text-xs text-gray-400">{new Date(evt.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
