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
 */
type DotPrefix<T extends string> = T extends "" ? "" : `.${T}`;

type DotKeys<T extends Record<string, unknown>> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? `${K}${DotPrefix<DotKeys<T[K]>>}`
    : K;
}[keyof T & string];

export type MessageKeys = DotKeys<Messages>;
