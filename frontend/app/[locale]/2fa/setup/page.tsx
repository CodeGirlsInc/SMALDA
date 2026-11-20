"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { API_V1_BASE, ApiError, request } from "@/lib/api-client";
import { qrCodeDataUri } from "@/lib/qr-code";

type Step = "loading" | "scan" | "confirmed" | "error";

export default function TwoFactorSetupPage() {
  const t = useTranslations("auth.twoFactor.setup");
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [otpUri, setOtpUri] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [totpCode, setTotpCode] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const init2FA = useCallback(async () => {
    setStep("loading");
    setError("");
    try {
      const data = await request<{ otpauthUrl?: string; secret?: string }>(
        `${API_V1_BASE}/auth/2fa/setup`,
        { method: "POST" },
      );
      if (!data.secret || !data.otpauthUrl) {
        setError(t("missingSecret"));
        setStep("error");
        return;
      }
      setSecret(data.secret);
      setOtpUri(data.otpauthUrl);
      setStep("scan");
    } catch (err) {
      setError(
        err instanceof ApiError && err.backendMessage
          ? err.backendMessage
          : t("initError"),
      );
      setStep("error");
    }
  }, [t]);

  useEffect(() => {
    void init2FA();
  }, [init2FA]);

  const qrSrc = useMemo(() => qrCodeDataUri(otpUri), [otpUri]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (totpCode.length !== 6) {
      setError(t("invalidCode"));
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const data = await request<{ backupCodes?: string[] }>(
        `${API_V1_BASE}/auth/2fa/verify`,
        {
          method: "POST",
          body: { code: totpCode },
        },
      );
      setBackupCodes(data.backupCodes ?? []);
      setStep("confirmed");
    } catch (err) {
      setError(
        err instanceof ApiError && err.backendMessage
          ? err.backendMessage
          : t("verifyError"),
      );
    } finally {
      setVerifying(false);
    }
  }

  async function copyBackupCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
    } catch {
      setError(t("copyError"));
    }
  }

  function downloadBackupCodes() {
    const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smalda-2fa-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4 py-12 text-white">
      <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
        <h1 className="mb-6 text-center text-2xl font-bold">{t("title")}</h1>

        {step === "loading" && (
          <div className="flex flex-col items-center py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-sm text-gray-400">{t("loading")}</p>
          </div>
        )}

        {step === "error" && (
          <div className="py-4 text-center">
            <p role="alert" className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => void init2FA()}
              className="mt-6 w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              {t("retry")}
            </button>
          </div>
        )}

        {step === "scan" && (
          <div>
            <p className="text-sm text-gray-300">{t("scanInstructions")}</p>

            <div className="my-6 flex justify-center rounded-lg bg-white p-4">
              {qrSrc ? (
                <img src={qrSrc} alt={t("qrAlt")} className="h-48 w-48" />
              ) : (
                <p className="text-sm text-gray-900">{t("qrUnavailable")}</p>
              )}
            </div>

            <p className="text-center text-xs text-gray-400">
              {t("manualSecret")}:{" "}
              <code className="rounded bg-gray-900 px-2 py-1 text-yellow-400">{secret}</code>
            </p>

            <form onSubmit={handleVerify} className="mt-6">
              <label htmlFor="setup-code" className="block text-xs font-medium text-gray-300">
                {t("codeLabel")}
              </label>
              <input
                id="setup-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => {
                  setTotpCode(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                placeholder={t("codePlaceholder")}
                className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-center text-xl font-mono tracking-widest text-white focus:border-blue-500 focus:outline-none"
              />
              {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={verifying}
                className="mt-4 w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {verifying ? t("confirming") : t("confirm")}
              </button>
            </form>
          </div>
        )}

        {step === "confirmed" && (
          <div>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-400">
              ✓
            </div>
            <h2 className="text-center text-xl font-semibold text-green-400">
              {t("successTitle")}
            </h2>
            <p className="mt-2 text-center text-xs text-gray-300">{t("saveCodes")}</p>

            <div className="my-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 font-mono text-sm text-yellow-300">
              {backupCodes.length > 0 ? (
                backupCodes.map((code) => <div key={code} className="py-1">{code}</div>)
              ) : (
                <p className="text-center">{t("noBackupCodes")}</p>
              )}
            </div>

            {error && <p role="alert" className="mb-4 text-center text-xs text-red-400">{error}</p>}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => void copyBackupCodes()}
                className="w-1/2 rounded-md border border-gray-700 bg-gray-900 py-2 text-xs font-medium text-gray-200 hover:bg-gray-800"
              >
                {copied ? t("copied") : t("copy")}
              </button>
              <button
                type="button"
                onClick={downloadBackupCodes}
                className="w-1/2 rounded-md border border-gray-700 bg-gray-900 py-2 text-xs font-medium text-gray-200 hover:bg-gray-800"
              >
                {t("download")}
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push("/settings/security")}
              className="mt-6 w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              {t("done")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
