'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Document {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  riskScore?: number;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/documents')
      .then((res) => res.json())
      .then(setDocuments)
      .catch(() => {});
  }, []);

  const filtered = documents.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Link
          href="/documents/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Upload Document
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search documents..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtered.length === 0 ? (
        <p className="text-gray-500">No documents found.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-sm">Title</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Status</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Risk</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{doc.title}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100">{doc.status}</span>
                  </td>
                  <td className="px-4 py-3">{doc.riskScore != null ? `${doc.riskScore}%` : '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/documents/${doc.id}`} className="text-blue-600 hover:underline text-sm">
                      View
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
