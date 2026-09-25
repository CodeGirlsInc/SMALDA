"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  routing,
  type Locale,
} from "@/i18n/routing";

function persistLocalePreference(locale: Locale): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * Dropdown that switches the active UI language. Switching triggers a
 * client-side navigation to the same route under the new locale (no full page
 * reload).
 */
export default function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const activeLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSelect(nextLocale: string) {
    if (!routing.locales.includes(nextLocale as Locale)) return;
    const locale = nextLocale as Locale;
    persistLocalePreference(locale);
    if (locale === activeLocale) return;

    startTransition(() => {
      // `pathname` is locale-agnostic; next-intl re-attaches the new locale.
      router.replace(pathname, { locale });
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{t("label")}</span>
      <select
        value={activeLocale}
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
