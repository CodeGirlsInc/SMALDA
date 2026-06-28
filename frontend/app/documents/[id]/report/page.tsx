'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface RiskReport {
  documentId: string;
  title: string;
  riskScore: number;
  riskFlags: string[];
  generatedAt: string;
}

export default function DocumentReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<RiskReport | null>(null);

  useEffect(() => {
    fetch(`/api/documents/${id}/report`)
      .then((res) => res.json())
      .then(setReport)
      .catch(() => {});
  }, [id]);

  const handlePrint = () => window.print();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 no-print">
        <Link href={`/documents/${id}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to Document
        </Link>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm"
        >
          Print / Export PDF
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-2">Risk Assessment Report</h1>

      {!report ? (
        <p className="text-gray-500">Generating report...</p>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="text-sm text-gray-500">
            Generated: {new Date(report.generatedAt).toLocaleString()}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Document</h2>
            <p className="text-gray-700">{report.title}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Risk Score</h2>
            <p className={`text-3xl font-bold ${
              report.riskScore < 30 ? 'text-green-600' : report.riskScore < 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {report.riskScore}%
            </p>
          </div>

          {report.riskFlags.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Flags</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Flag</th>
                    <th className="text-left py-2">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.riskFlags.map((flag, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{flag}</td>
                      <td className="py-2">
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs">
                          {report.riskScore >= 60 ? 'High' : 'Medium'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
