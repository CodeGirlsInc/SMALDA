'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VerifyDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ txHash: string } | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/documents/${id}/verify`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        alert('Verification request failed.');
      }
    } catch {
      alert('Verification request failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Verify Document</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <p className="text-gray-600">
          Anchor this document&apos;s hash on the Stellar blockchain. Once verified, the
          transaction hash will be stored and the document status will update to Verified.
        </p>

        <button
          onClick={handleVerify}
          disabled={verifying || !!result}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {verifying ? 'Verifying...' : result ? 'Verification Complete' : 'Verify on Stellar'}
        </button>

        {result && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-700">Document verified on Stellar</p>
            <p className="text-xs font-mono mt-1 break-all text-green-600">{result.txHash}</p>
          </div>
        )}

        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:underline"
        >
          &larr; Back
        </button>
      </div>
    </div>
  );
}
