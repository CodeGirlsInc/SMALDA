"use client";

import React from "react";
import { useTranslations } from "next-intl";

export interface ErrorBannerProps {
  /**
   * Translation key path emitted by the api-client. Of form
   * `errors.status.<leaf>`, e.g. "errors.status.unauthorized".
   */
  messageKey: string;
  /** Optional supplementary grey text. Internal identifiers must not be passed. */
  detail?: string;
  /** Optional callback that surfaces a "Try again" action. */
  onRetry?: () => void;
}

/**
 * Standardized error feedback component used wherever the API client
 * throws an ApiError. The banner resolves a translation key under
 * `errors.status.*` via next-intl; if the key is missing, the generic
 * `errors.description` fallback is rendered instead so a missing
 * translation does not produce an empty banner.
 */
export function ErrorBanner({ messageKey, detail, onRetry }: ErrorBannerProps) {
  const tRoot = useTranslations("errors");
  const tStatus = useTranslations("errors.status");

  const leaf = messageKey.startsWith("errors.")
    ? messageKey.slice("errors.".length)
    : messageKey;

  let body: string;
  try {
    body = tStatus(leaf.replace(/^status\./, "") as never);
  } catch {
    body = tRoot("description");
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <strong className="block font-semibold">{body}</strong>
      {detail ? <p className="mt-1 text-xs text-red-700">{detail}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {tRoot("tryAgain")}
        </button>
      ) : null}
    </div>
  );
}
