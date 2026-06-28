'use client';

import { useEffect, useState } from 'react';

interface DashboardStats {
  totalDocuments: number;
  verifiedDocuments: number;
  flaggedDocuments: number;
  pendingDocuments: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch('/api/documents/stats')
      .then((res) => res.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Documents" value={stats.totalDocuments} color="blue" />
          <StatCard label="Verified" value={stats.verifiedDocuments} color="green" />
          <StatCard label="Flagged" value={stats.flaggedDocuments} color="red" />
          <StatCard label="Pending" value={stats.pendingDocuments} color="yellow" />
        </div>
      )}

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Documents</h2>
        <p className="text-gray-500">No documents uploaded yet.</p>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
