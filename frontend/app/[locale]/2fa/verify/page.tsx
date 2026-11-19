"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { API_V1_BASE, ApiError, request } from "@/lib/api-client";
import {
  clearTwoFactorToken,
  readTwoFactorToken,
  resolvePostLoginPath,
  storeSession,
  type LoginResponse,
} from "@/lib/auth-session";

export default function TwoFactorVerifyPage() {
  const t = useTranslations("auth.twoFactor.verify");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [twoFactorToken] = useState(() => {
    const result = readTwoFactorToken();
    return result.ok ? result.value : null;
  });
  const [code, setCode] = useState<string>("");
  const [isBackupCode, setIsBackupCode] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const redirect = resolvePostLoginPath(searchParams.get("redirect"));
  const resumeId = searchParams.get("resume");
  const missingToken = !twoFactorToken;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) {
      setError(t("codeRequired"));
      return;
    }
    if (!twoFactorToken) {
      setError(t("expired"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await request<LoginResponse>(
        `${API_V1_BASE}/auth/2fa/challenge`,
        {
          method: "POST",
          anonymous: true,
          body: { twoFactorToken, code },
        },
      );
      const stored = storeSession(data, resumeId ?? undefined);
      if (!stored.ok) {
        setError(t("generic"));
        return;
      }
      clearTwoFactorToken();
      router.replace(redirect);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.backendMessage ??
            (err.status === 401
              ? t("expired")
              : err.status === 429
                ? t("rateLimited")
                : t("generic")),
        );
      } else {
        setError(t("generic"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-2xl font-bold">{t("title")}</h1>
        <p className="mb-6 text-center text-xs text-gray-400">
          {t("description")}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="two-factor-code" className="block text-xs font-medium text-gray-300">
              {isBackupCode ? t("backupCodeLabel") : t("codeLabel")}
            </label>
            <input
              id="two-factor-code"
              type="text"
              autoComplete="one-time-code"
              value={code}
              disabled={loading || missingToken}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder={isBackupCode ? t("backupPlaceholder") : t("codePlaceholder")}
              className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-center font-mono text-lg text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {error && <p role="alert" className="mb-4 text-center text-xs text-red-400">{error}</p>}
          {missingToken && (
            <p className="mb-4 text-center text-xs text-gray-300">
              <Link href="/login" className="text-blue-400 underline hover:text-blue-300">
                {t("signIn")}
              </Link>
            </p>
          )}

          <button
            type="submit"
            disabled={loading || missingToken}
            className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? t("submitting") : t("submit")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsBackupCode(!isBackupCode);
              setCode("");
              setError("");
            }}
            className="text-xs text-blue-400 underline hover:text-blue-300"
          >
            {isBackupCode ? t("useAuthenticator") : t("useBackup")}
          </button>
        </div>
      </div>
    </main>
  );
}
