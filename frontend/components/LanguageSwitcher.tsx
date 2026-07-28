"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Persist the chosen language to the backend so it can be reused elsewhere
 * (e.g. for outgoing emails — see BE-86). Best-effort: a failure here must not
 * block the UI from switching languages.
 */
async function persistPreferredLanguage(language: string): Promise<void> {
  try {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("auth-token")
        : null;

    // Not signed in — the language still switches locally via the cookie/URL.
    if (!token) return;

    await fetch(`${API_BASE}/api/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ preferredLanguage: language }),
    });
  } catch {
    // Swallow — persistence is non-blocking.
  }
}

/**
 * Dropdown that switches the active UI language. Switching triggers a
 * client-side navigation to the same route under the new locale (no full page
 * reload) and, when the user is authenticated, saves the preference to the
 * backend.
 */
export default function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSelect(nextLocale: string) {
    if (nextLocale === locale) return;

    void persistPreferredLanguage(nextLocale);

    startTransition(() => {
      // `pathname` is locale-agnostic; next-intl re-attaches the new locale.
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={(event) => handleSelect(event.target.value)}
        disabled={isPending}
        aria-label={t("label")}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {t(loc)}
          </option>
        ))}
      </select>
    </label>
  );
}
