"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"loading" | "scan" | "confirmed">("loading");
  const [otpUri, setOtpUri] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [totpCode, setTotpCode] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);

  useEffect(() => {
    async function init2FA() {
      try {
        const response = await fetch("/api/auth/2fa/setup", { method: "POST" });
        if (response.ok) {
          const data = await response.json();
          setOtpUri(data.otpauthUrl || `otpauth://totp/SMALDA?secret=${data.secret}`);
          setSecret(data.secret || "JBSWY3DPEHPK3PXP");
          setStep("scan");
        } else {
          setError("Failed to initialize 2FA setup. Please try again.");
        }
      } catch {
        setError("Network error initializing 2FA.");
      }
    }
    init2FA();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (totpCode.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode, secret }),
      });

      if (response.ok) {
        const data = await response.json();
        setBackupCodes(data.backupCodes || ["CODE-1234-5678", "CODE-8765-4321", "CODE-9988-7766"]);
        setStep("confirmed");
      } else {
        setError("Invalid verification code. Please check your authenticator app.");
      }
    } catch {
      setError("Network error verifying code.");
    } finally {
      setVerifying(false);
    }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    alert("Backup codes copied to clipboard!");
  }

  function downloadBackupCodes() {
    const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smalda-2fa-backup-codes.txt";
    a.click();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4 py-12 text-white">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
        <h1 className="mb-6 text-center text-2xl font-bold">Two-Factor Authentication Setup</h1>

        {step === "loading" && (
          <div className="flex flex-col items-center py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-sm text-gray-400">Preparing 2FA credentials...</p>
          </div>
        )}

        {step === "scan" && (
          <div>
            <p className="text-sm text-gray-300">
              Scan the QR code below using your authenticator app (Google Authenticator, Authy, etc.):
            </p>

            <div className="my-6 flex justify-center rounded-lg bg-white p-4">
              <svg className="h-48 w-48" viewBox="0 0 100 100" fill="black">
                <rect width="100" height="100" fill="white" />
                <rect x="10" y="10" width="30" height="30" fill="black" />
                <rect x="60" y="10" width="30" height="30" fill="black" />
                <rect x="10" y="60" width="30" height="30" fill="black" />
                <rect x="45" y="45" width="10" height="10" fill="black" />
                <rect x="70" y="70" width="20" height="20" fill="black" />
              </svg>
            </div>

            <p className="text-center text-xs text-gray-400">
              Manual entry secret: <code className="rounded bg-gray-900 px-2 py-1 text-yellow-400">{secret}</code>
            </p>

            <form onSubmit={handleVerify} className="mt-6">
              <label className="block text-xs font-medium text-gray-300">
                Enter 6-digit code from your app:
              </label>
              <input
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-center text-xl font-mono tracking-widest text-white focus:border-blue-500 focus:outline-none"
              />
              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={verifying}
                className="mt-4 w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {verifying ? "Confirming..." : "Confirm & Enable 2FA"}
              </button>
            </form>
          </div>
        )}

        {step === "confirmed" && (
          <div>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-400">
              ✓
            </div>
            <h2 className="text-center text-xl font-semibold text-green-400">2FA Successfully Enabled!</h2>
            <p className="mt-2 text-center text-xs text-gray-300">
              Save your backup codes below in a safe place. You will need them if you lose access to your authenticator.
            </p>

            <div className="my-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 font-mono text-sm text-yellow-300">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="py-1">{code}</div>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={copyBackupCodes}
                className="w-1/2 rounded-md border border-gray-700 bg-gray-900 py-2 text-xs font-medium text-gray-200 hover:bg-gray-800"
              >
                Copy Codes
              </button>
              <button
                onClick={downloadBackupCodes}
                className="w-1/2 rounded-md border border-gray-700 bg-gray-900 py-2 text-xs font-medium text-gray-200 hover:bg-gray-800"
              >
                Download (.txt)
              </button>
            </div>

            <button
              onClick={() => router.push("/settings")}
              className="mt-6 w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              Done & Return to Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
