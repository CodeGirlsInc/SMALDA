/**
 * FE-70 — Tests for the i18n routing configuration.
 */

import { routing } from "@/i18n/routing";

describe("i18n routing config", () => {
  it("defines the expected locales", () => {
    expect(routing.locales).toEqual(["en", "fr", "es"]);
  });

  it("sets the default locale to 'en'", () => {
    expect(routing.defaultLocale).toBe("en");
  });

  it("uses 'as-needed' locale prefix strategy", () => {
    expect(routing.localePrefix).toBe("as-needed");
  });
});
