'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (!token) {
    setLoading(false);
    setError('Missing verification token.');
    return;
  }
  apiClient
    .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
    .then(() => {
      setSuccess(true);
      setLoading(false);
    })
    .catch((err: unknown) => {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Verification failed.'
      );
      setLoading(false);
    });
}, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Verification failed</h1>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
          <Link
            href="/register"
            className="mt-6 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Email verified</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your email has been verified. You can now log in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
