'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Dispute {
  id: string;
  documentId: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  useEffect(() => {
    fetch('/api/disputes')
      .then((r) => r.json())
      .then(setDisputes)
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Disputes</h1>
        <Link
          href="/documents"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          + New Dispute
        </Link>
      </div>

      {disputes.length === 0 ? (
        <p className="text-gray-500">No disputes filed.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Document</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{d.documentId}</td>
                  <td className="px-4 py-3">{d.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      d.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                      d.status === 'resolved' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/disputes/${d.id}`} className="text-blue-600 hover:underline text-xs">
                      View &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
