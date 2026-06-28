'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface HistoryEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

export default function DocumentHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [events, setEvents] = useState<HistoryEvent[]>([]);

  useEffect(() => {
    fetch(`/api/documents/${id}/history`)
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => {});
  }, [id]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href={`/documents/${id}`} className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        &larr; Back to Document
      </Link>

      <h1 className="text-2xl font-bold mb-6">Document History</h1>

      {events.length === 0 ? (
        <p className="text-gray-500">No history events recorded.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {events.map((event) => (
              <div key={event.id} className="relative pl-10">
                <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-500" />
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="font-medium text-sm">{event.type}</p>
                  <p className="text-gray-600 text-sm mt-1">{event.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
