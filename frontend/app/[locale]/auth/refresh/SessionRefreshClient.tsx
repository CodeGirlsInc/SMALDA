"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  clearSession,
  isDefinitiveRefreshError,
  refreshSession,
} from "@/lib/api-client";
import { resolvePostLoginPath } from "@/lib/auth-session";

export default function SessionRefreshClient() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const target = resolvePostLoginPath(searchParams.get("redirect"));

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        await refreshSession();
        router.replace(target === "/auth/refresh" ? "/" : target);
      } catch (error) {
        if (isDefinitiveRefreshError(error)) {
          await clearSession();
          const params = new URLSearchParams({ redirect: target });
          router.replace(`/login?${params.toString()}`);
          return;
        }
        setFailed(true);
      }
    })();
  }, [router, target]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md text-center" aria-live="polite">
        <h1 className="text-2xl font-semibold text-gray-900">
          {failed
            ? t("auth.sessionRefresh.errorTitle")
            : t("auth.sessionRefresh.loading")}
        </h1>
        {failed ? (
          <p className="mt-2 text-sm text-gray-600">
            {t("auth.sessionRefresh.errorDescription")}
          </p>
        ) : null}
      </section>
    </main>
  );
}
