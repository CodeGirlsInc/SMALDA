"use client";

import { useLocale } from "next-intl";

/**
 * Locale-aware formatting utilities.
 * These hooks use the active locale from next-intl to produce
 * correctly formatted dates, numbers, and relative times.
 */

export function useDateFormatting() {
  const locale = useLocale();

  function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
    return new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    });
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(locale, options).format(value);
  }

  function formatPercent(value: number): string {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value / 100);
  }

  function formatRelativeTime(iso: string | null): string {
    if (!iso) return "Never checked";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "Never checked";

    const diffSeconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (diffSeconds < 60) return "Checked just now";
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60)
      return `Checked ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24)
      return `Checked ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    const diffDays = Math.round(diffHours / 24);
    return `Checked ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return { formatDate, formatDateTime, formatNumber, formatPercent, formatRelativeTime };
}
