'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface VerificationResult {
  valid: boolean;
  documentId?: string;
  timestamp?: string;
  owner?: string;
  message: string;
}

export default function VerifyPublicPage() {
  const { txHash } = useParams<{ txHash: string }>();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/verify/${txHash}`)
      .then((res) => res.json())
      .then((data) => setResult(data))
      .catch(() => setResult({ valid: false, message: 'Verification lookup failed.' }))
      .finally(() => setLoading(false));
  }, [txHash]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {loading ? (
          <p className="text-gray-500">Verifying...</p>
        ) : (
          <>
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${result?.valid ? 'bg-green-100' : 'bg-red-100'}`}>
              {result?.valid ? (
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </div>

            <h1 className={`text-xl font-bold mt-4 ${result?.valid ? 'text-green-700' : 'text-red-700'}`}>
              {result?.valid ? 'Document Verified' : 'Verification Failed'}
            </h1>

            <p className="text-sm text-gray-600 mt-2">{result?.message}</p>

            {result?.valid && (
              <div className="mt-4 text-left text-sm space-y-2 bg-gray-50 rounded-lg p-4">
                {result.documentId && (
                  <p><span className="font-medium">Document:</span> {result.documentId}</p>
                )}
                {result.timestamp && (
                  <p><span className="font-medium">Verified:</span> {new Date(result.timestamp).toLocaleString()}</p>
                )}
                {result.owner && (
                  <p><span className="font-medium">Owner:</span> {result.owner}</p>
                )}
              </div>
            )}

            <p className="text-xs font-mono text-gray-400 mt-4 break-all">{txHash}</p>
          </>
        )}
      </div>
    </div>
  );
}
