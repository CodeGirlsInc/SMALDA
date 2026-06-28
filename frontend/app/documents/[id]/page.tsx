'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface DocumentDetail {
  id: string;
  title: string;
  status: string;
  riskScore?: number;
  riskFlags?: string[];
  fileHash: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((res) => res.json())
      .then(setDoc)
      .catch(() => {});
  }, [id]);

  if (!doc) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500">Loading document...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/documents" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        &larr; Back to Documents
      </Link>

      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">{doc.title}</h1>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Status</p>
            <p className="font-medium">{doc.status}</p>
          </div>
          <div>
            <p className="text-gray-500">Risk Score</p>
            <p className="font-medium">{doc.riskScore != null ? `${doc.riskScore}%` : 'Not assessed'}</p>
          </div>
          <div>
            <p className="text-gray-500">File Type</p>
            <p className="font-medium">{doc.mimeType}</p>
          </div>
          <div>
            <p className="text-gray-500">File Size</p>
            <p className="font-medium">{(doc.fileSize / 1024).toFixed(1)} KB</p>
          </div>
          <div>
            <p className="text-gray-500">File Hash</p>
            <p className="font-medium font-mono text-xs truncate">{doc.fileHash}</p>
          </div>
          <div>
            <p className="text-gray-500">Uploaded</p>
            <p className="font-medium">{new Date(doc.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {doc.riskFlags && doc.riskFlags.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Risk Flags</h2>
            <ul className="space-y-1">
              {doc.riskFlags.map((flag, i) => (
                <li key={i} className="px-3 py-1 bg-red-50 text-red-700 rounded text-sm">{flag}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
