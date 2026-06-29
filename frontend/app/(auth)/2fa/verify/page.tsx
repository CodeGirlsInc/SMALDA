'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Shield, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

function TwoFAVerifyForm() {
  const searchParams = useSearchParams();
  const preAuthToken = searchParams.get('preAuthToken');
  const [totpCode, setTotpCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/auth/2fa/authenticate', {
        preAuthToken,
        totpToken: useBackup ? undefined : totpCode,
        backupCode: useBackup ? backupCode : undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Authentication failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Verified</h1>
          <p className="mt-2 text-sm text-gray-500">
            Two-factor authentication successful. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  if (!preAuthToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Invalid session</h1>
          <p className="mt-2 text-sm text-gray-500">
            Missing pre-auth token. Please log in again.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-blue-600" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Two-factor authentication</h1>
          <p className="mt-2 text-sm text-gray-500">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          {!useBackup ? (
            <Input
              label="Authenticator code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          ) : (
            <Input
              label="Backup code"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              placeholder="Enter backup code"
              autoFocus
            />
          )}

          <Button
            type="submit"
            loading={loading}
            disabled={useBackup ? !backupCode : totpCode.length !== 6}
            className="w-full"
          >
            Verify
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setUseBackup(!useBackup);
              setError(null);
            }}
            className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <KeyRound className="h-4 w-4" />
            {useBackup ? 'Use authenticator app instead' : 'Use a backup code instead'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function TwoFAVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <TwoFAVerifyForm />
    </Suspense>
  );
}
