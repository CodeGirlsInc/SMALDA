import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * Per-request i18n configuration. Referenced by the next-intl plugin
 * (see `next.config.ts`) and used to load the message catalog for the
 * resolved locale on every request.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` corresponds to the `[locale]` segment; fall back to the
  // default locale when it is missing or unsupported.
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
