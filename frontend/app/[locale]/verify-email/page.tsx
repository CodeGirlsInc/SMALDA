"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "failure">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resendEmail, setResendEmail] = useState<string>("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (!token) {
      setStatus("failure");
      setErrorMessage("No verification token provided in URL.");
      return;
    }

    async function verify() {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          method: "GET",
        });

        if (response.ok) {
          setStatus("success");
          setTimeout(() => {
            router.push("/login");
          }, 3000);
        } else {
          const data = await response.json().catch(() => ({}));
          setStatus("failure");
          setErrorMessage(data.message || "Failed to verify email. The token may be expired or invalid.");
        }
      } catch (err) {
        setStatus("failure");
        setErrorMessage("Network error verifying email. Please check your connection.");
      }
    }

    verify();
  }, [token, router]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail) return;

    setResendStatus("sending");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });

      if (response.ok) {
        setResendStatus("sent");
      } else {
        setResendStatus("error");
      }
    } catch {
      setResendStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
        <h1 className="mb-6 text-center text-2xl font-bold">Email Verification</h1>

        {status === "loading" && (
          <div className="flex flex-col items-center py-6">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-sm text-gray-400">Verifying your email address...</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-400">
              ✓
            </div>
            <h2 className="text-xl font-semibold text-green-400">Email Verified Successfully!</h2>
            <p className="mt-2 text-sm text-gray-300">
              Your account is ready. Redirecting to login page in 3 seconds...
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                Go to Login Now
              </Link>
            </div>
          </div>
        )}

        {status === "failure" && (
          <div className="py-2">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              ✕
            </div>
            <h2 className="text-center text-lg font-semibold text-red-400">Verification Failed</h2>
            <p className="mt-2 text-center text-sm text-gray-300">{errorMessage}</p>

            <form onSubmit={handleResend} className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
              <label className="block text-xs font-medium text-gray-400">Resend Verification Email</label>
              <input
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="Enter your registered email"
                className="mt-2 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={resendStatus === "sending"}
                className="mt-3 w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {resendStatus === "sending" ? "Sending..." : "Resend Email"}
              </button>
              {resendStatus === "sent" && (
                <p className="mt-2 text-center text-xs text-green-400">Verification email sent! Check your inbox.</p>
              )}
              {resendStatus === "error" && (
                <p className="mt-2 text-center text-xs text-red-400">Failed to resend. Please try again.</p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
