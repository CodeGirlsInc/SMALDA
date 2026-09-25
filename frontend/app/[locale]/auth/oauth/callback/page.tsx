"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { storeSession, resolvePostLoginPath } from "@/lib/auth-session";
import { consumeOAuthRedirect } from "@/lib/oauth-redirect";

export default function OAuthCallbackPage() {
  const t = useTranslations();
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    if (!accessToken || accessToken.length > 4096) {
      setFailed(true);
      return;
    }

    storeSession({ access_token: accessToken });
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    const target = resolvePostLoginPath(consumeOAuthRedirect());
    router.replace(
      target === "/auth/oauth/callback" || target === "/auth/refresh"
        ? "/"
        : target,
    );
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md text-center" aria-live="polite">
        <h1 className="text-2xl font-semibold text-gray-900">
          {failed ? t("auth.oauthCallback.errorTitle") : t("auth.oauthCallback.loading")}
        </h1>
        {failed ? (
          <>
            <p className="mt-2 text-sm text-gray-600">
              {t("auth.oauthCallback.errorDescription")}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              {t("auth.oauthCallback.signIn")}
            </Link>
          </>
        ) : null}
      </section>
    </main>
  );
}
