'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

type SetupResponse = {
  qrCodeDataUrl: string;
  secret: string;
};

export default function TwoFASetupPage() {
  const router = useRouter();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiClient
      .post<SetupResponse>('/auth/2fa/setup')
      .then((res) => {
        setQrCodeDataUrl(res.data.qrCodeDataUrl);
        setSecret(res.data.secret);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Failed to initialize 2FA setup.'
        );
        setLoading(false);
      });
  }, []);

  const handleCopySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/auth/2fa/activate', { totpToken: totpCode });
      setSuccess(true);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Invalid code. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">2FA enabled</h1>
          <p className="mt-2 text-sm text-gray-500">
            Two-factor authentication has been activated on your account.
          </p>
          <Button
            className="mt-6"
            onClick={() => router.push('/settings')}
          >
            Back to settings
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md" title="Enable two-factor authentication" subtitle="Scan the QR code with your authenticator app">
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="space-y-6">
          {qrCodeDataUrl && (
            <div className="flex flex-col items-center">
              <img src={qrCodeDataUrl} alt="2FA QR Code" className="h-48 w-48 rounded-lg border border-gray-200" />
            </div>
          )}

          {secret && (
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-700 break-all">
                {secret}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopySecret}
                aria-label="Copy secret"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Authenticator code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <Button loading={submitting} disabled={!secret || totpCode.length !== 6} className="w-full">
              Verify and enable
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
