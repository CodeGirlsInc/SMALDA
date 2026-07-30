"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeToken = searchParams.get("challenge");

  const [code, setCode] = useState<string>("");
  const [isBackupCode, setIsBackupCode] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    if (!code) {
      setError("Please enter your verification code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/2fa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken,
          code,
          isBackupCode,
        }),
      });

      if (response.ok) {
        router.push("/dashboard");
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);

        if (nextAttempts >= 3) {
          setLockoutSeconds(15);
          setError("Too many failed attempts. Please wait 15 seconds before trying again.");
        } else {
          setError(`Invalid 2FA code. Attempt ${nextAttempts} of 3 before temporary lockout.`);
        }
      }
    } catch {
      setError("Network error during verification.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-2xl font-bold">Two-Factor Verification</h1>
        <p className="mb-6 text-center text-xs text-gray-400">
          Enter the code from your authenticator app or use a backup code to log in.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300">
              {isBackupCode ? "Backup Code" : "6-Digit Authenticator Code"}
            </label>
            <input
              type="text"
              value={code}
              disabled={lockoutSeconds > 0}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder={isBackupCode ? "CODE-1234-5678" : "123456"}
              className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-center font-mono text-lg text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {error && <p className="mb-4 text-center text-xs text-red-400">{error}</p>}
          {lockoutSeconds > 0 && (
            <p className="mb-4 text-center text-xs text-yellow-400">
              Locked out: retry available in {lockoutSeconds}s
            </p>
          )}

          <button
            type="submit"
            disabled={loading || lockoutSeconds > 0}
            className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify & Continue"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsBackupCode(!isBackupCode);
              setCode("");
              setError("");
            }}
            className="text-xs text-blue-400 underline hover:text-blue-300"
          >
            {isBackupCode ? "Use Authenticator App Code" : "Use Emergency Backup Code"}
          </button>
        </div>
      </div>
    </div>
  );
}
