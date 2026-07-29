/**
 * Type-safe message keys derived from en.json.
 * Import this type and use it to ensure translation key references
 * are compile-time safe.
 *
 * Usage:
 *   import { type Messages } from "@/i18n/messages";
 *   const t = useTranslations<Messages>("namespace");
 */

import enMessages from "../messages/en.json";

export type Messages = typeof enMessages;

/**
 * Extracts all dot-separated key paths from a nested object type.
 * e.g., { a: { b: string } } => "a" | "a.b"
 *
 * Depth is limited to 3 levels to avoid TS2589 on large message files.
 */
type DotPrefix<T extends string> = T extends "" ? "" : `.${T}`;

type DotKeys<T, Depth extends unknown[] = []> = Depth["length"] extends 3
  ? never
  : T extends Record<string, unknown>
    ? {
        [K in keyof T & string]: T[K] extends Record<string, unknown>
          ? `${K}${DotPrefix<DotKeys<T[K], [...Depth, unknown]>>}`
          : K;
      }[keyof T & string]
    : never;

export type MessageKeys = DotKeys<Messages>;
