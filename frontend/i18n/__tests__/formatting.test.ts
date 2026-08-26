import { renderHook } from "@testing-library/react";
import { useDateFormatting } from "../formatting";

jest.mock("next-intl", () => ({
  useLocale: jest.fn(),
}));

const { useLocale } = require("next-intl") as {
  useLocale: jest.Mock;
};

describe("useDateFormatting locale-specific formatting", () => {
  const iso = "2024-01-15T12:00:00Z";
  const number = 1234.56;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("formatDate", () => {
    it("produces different outputs across en, es, and fr", () => {
      const outputs: Record<string, string> = {};

      (["en", "es", "fr"] as const).forEach((locale) => {
        (useLocale as jest.Mock).mockReturnValue(locale);
        const { result } = renderHook(() => useDateFormatting());
        outputs[locale] = result.current.formatDate(iso);
      });

      expect(outputs.en).not.toBe(outputs.es);
      expect(outputs.en).not.toBe(outputs.fr);
      expect(outputs.es).not.toBe(outputs.fr);
      expect(new Set(Object.values(outputs)).size).toBe(3);
    });

    it("includes the year in all locales", () => {
      (["en", "es", "fr"] as const).forEach((locale) => {
        (useLocale as jest.Mock).mockReturnValue(locale);
        const { result } = renderHook(() => useDateFormatting());
        expect(result.current.formatDate(iso)).toContain("2024");
      });
    });
  });

  describe("formatDateTime", () => {
    it("includes date and time information across locales", () => {
      const outputs: Record<string, string> = {};

      (["en", "es", "fr"] as const).forEach((locale) => {
        (useLocale as jest.Mock).mockReturnValue(locale);
        const { result } = renderHook(() => useDateFormatting());
        outputs[locale] = result.current.formatDateTime(iso);
      });

      expect(new Set(Object.values(outputs)).size).toBe(3);
      (["en", "es", "fr"] as const).forEach((locale) => {
        expect(outputs[locale]).toContain("2024");
      });
    });
  });

  describe("formatNumber", () => {
    it("uses locale-specific decimal separators", () => {
      const outputs: Record<string, string> = {};

      (["en", "es", "fr"] as const).forEach((locale) => {
        (useLocale as jest.Mock).mockReturnValue(locale);
        const { result } = renderHook(() => useDateFormatting());
        outputs[locale] = result.current.formatNumber(number);
      });

      expect(outputs.en).toContain(".");
      expect(outputs.es).toContain(",");
      expect(outputs.fr).toContain(",");
    });

    it("produces different outputs across en, es, and fr", () => {
      const outputs: Record<string, string> = {};

      (["en", "es", "fr"] as const).forEach((locale) => {
        (useLocale as jest.Mock).mockReturnValue(locale);
        const { result } = renderHook(() => useDateFormatting());
        outputs[locale] = result.current.formatNumber(number);
      });

      expect(outputs.en).not.toBe(outputs.es);
      expect(outputs.en).not.toBe(outputs.fr);
      expect(outputs.es).not.toBe(outputs.fr);
      expect(new Set(Object.values(outputs)).size).toBe(3);
    });
  });

  describe("formatPercent", () => {
    it("formats percentages across locales", () => {
      const outputs: Record<string, string> = {};

      (["en", "es", "fr"] as const).forEach((locale) => {
        (useLocale as jest.Mock).mockReturnValue(locale);
        const { result } = renderHook(() => useDateFormatting());
        outputs[locale] = result.current.formatPercent(50);
      });

      expect(new Set(Object.values(outputs)).size).toBe(3);
      (["en", "es", "fr"] as const).forEach((locale) => {
        expect(outputs[locale]).toContain("%");
      });
    });
  });
});
