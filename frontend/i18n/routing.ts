import { defineRouting } from "next-intl/routing";

/**
 * Central i18n routing configuration shared by the middleware, the request
 * config and the navigation helpers.
 *
 * `localePrefix: "as-needed"` keeps existing English URLs untouched (`/`,
 * `/settings/security`, …) while non-default locales are served under a prefix
 * (`/fr/settings/security`, `/es/…`). This lets us introduce i18n without
 * breaking any links that already point at the English routes.
 */
export const routing = defineRouting({
  // Add a locale here + a matching `messages/<locale>.json` file to ship it.
  locales: ["en", "fr", "es"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
