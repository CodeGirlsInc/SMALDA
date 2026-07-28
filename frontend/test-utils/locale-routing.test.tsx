/**
 * FE-70 — Tests for locale resolution logic.
 */

import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

describe("locale resolution", () => {
  it("accepts supported locales", () => {
    expect(hasLocale(routing.locales, "en")).toBe(true);
    expect(hasLocale(routing.locales, "fr")).toBe(true);
    expect(hasLocale(routing.locales, "es")).toBe(true);
  });

  it("rejects unsupported locales", () => {
    expect(hasLocale(routing.locales, "de")).toBe(false);
    expect(hasLocale(routing.locales, "zh")).toBe(false);
    expect(hasLocale(routing.locales, "pt")).toBe(false);
  });

  it("returns false for empty / undefined input", () => {
    expect(hasLocale(routing.locales, undefined)).toBe(false);
    expect(hasLocale(routing.locales, "")).toBe(false);
  });
});
