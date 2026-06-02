"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Step = "qr" | "verify" | "backup" | "disable";

interface SetupData {
  qrCodeUrl: string;
  secret: string;
}

interface VerifyData {
  backupCodes: string[];
}

function CodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder="000000"
      className="w-40 rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

export default function TwoFactorSetupPage({
  alreadyEnabled = false,
}: {
  alreadyEnabled?: boolean;
}) {
  const [step, setStep] = useState<Step>(alreadyEnabled ? "disable" : "qr");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hasFetched = useRef(false);

  const token = () =>
    typeof localStorage !== "undefined"
      ? (localStorage.getItem("access_token") ?? "")
      : "";

  useEffect(() => {
    if (step !== "qr" || hasFetched.current) return;
    hasFetched.current = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/module/auth/2fa/setup`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token()}` },
          }
        );
        if (!res.ok) throw new Error("Failed to start 2FA setup.");
        const data: SetupData = await res.json();
        setSetupData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [step]);

  async function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/module/auth/2fa/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`,
          },
          body: JSON.stringify({ code }),
        }
      );
      if (!res.ok) throw new Error("Invalid code. Please try again.");
      const data: VerifyData = await res.json();
      setBackupCodes(data.backupCodes);
      setStep("backup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (disableCode.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/module/auth/2fa/disable`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`,
          },
          body: JSON.stringify({ code: disableCode }),
        }
      );
      if (!res.ok) throw new Error("Invalid code. Could not disable 2FA.");
      window.location.href = "/profile";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyCodes() {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "disable") {
    return (
      <div className="mx-auto max-w-md space-y-6 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Disable 2FA</h1>
        <p className="text-sm text-gray-600">
          Enter your current authenticator code to disable two-factor
          authentication.
        </p>
        <CodeInput value={disableCode} onChange={setDisableCode} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleDisable}
            disabled={loading || disableCode.length !== 6}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Disabling…" : "Disable 2FA"}
          </button>
          <Link
            href="/profile"
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </div>
    );
  }

  if (step === "backup") {
    return (
      <div className="mx-auto max-w-md space-y-6 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">2FA Enabled!</h1>
        <p className="text-sm text-gray-600">
          Save these backup codes somewhere safe. Each can be used once to
          access your account if you lose your authenticator.
        </p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm">
          {backupCodes.map((c) => (
            <div key={c} className="py-0.5">{c}</div>
          ))}
        </div>
        <button
          onClick={handleCopyCodes}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {copied ? "Copied!" : "Copy Codes"}
        </button>
        <Link
          href="/profile"
          className="block rounded-lg bg-blue-600 px-5 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
        >
          Go to Profile
        </Link>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="mx-auto max-w-md space-y-6 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Step 2: Verify Code</h1>
        <p className="text-sm text-gray-600">
          Enter the 6-digit code from your authenticator app to confirm setup.
        </p>
        <CodeInput value={code} onChange={setCode} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify & Enable"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Step 1: Scan QR Code
      </h1>
      <p className="text-sm text-gray-600">
        Open your authenticator app (e.g. Google Authenticator, Authy) and scan
        the QR code below, or enter the secret manually.
      </p>

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {setupData && !loading && (
        <div className="space-y-4">
          <div className="flex justify-center rounded-lg border border-gray-200 bg-white p-4">
            <Image
              src={setupData.qrCodeUrl}
              alt="2FA QR Code"
              width={200}
              height={200}
              unoptimized
            />
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Manual entry secret
            </p>
            <p className="break-all font-mono text-sm text-gray-800">
              {setupData.secret}
            </p>
          </div>
          <button
            onClick={() => setStep("verify")}
            className="w-full rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Next: Enter Code
          </button>
        </div>
      )}
    </div>
  );
}
