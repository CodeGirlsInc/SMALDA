"use client";

import { useEffect, useRef, useCallback } from "react";

const ACCESS_TOKEN_KEY = "auth-token";

// ── JWT expiry helper ───────────────────────────────────────────────────────

function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) return null;
    // exp is in seconds; return ms until expiry
    return payload.exp * 1000 - Date.now();
  } catch {
    return null;
  }
}

// ── Cross-tab logout sync ───────────────────────────────────────────────────

/**
 * Listen for the `logout-event` localStorage key written by clearSession()
 * in other tabs and redirect to login. Call once on app bootstrap.
 */
export function initCrossTabLogoutSync(): () => void {
  if (typeof window === "undefined") return () => {};

  function handler(event: StorageEvent) {
    if (event.key === "logout-event" && event.newValue) {
      window.location.href = "/login";
    }
  }

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

// ── Session expiry warning hook ─────────────────────────────────────────────

const WARNING_BEFORE_MS = 5 * 60 * 1000; // warn 5 minutes before expiry

interface UseSessionExpiryWarningOptions {
  /** Called when the user clicks "Stay signed in" — should trigger a refresh. */
  onRefresh: () => Promise<void>;
  /** Whether the user is currently authenticated (skip if false). */
  enabled?: boolean;
}

/**
 * Polls the access token's `exp` claim and prompts the user with a
 * "Stay signed in?" dialog a few minutes before the session expires.
 *
 * If the user confirms, calls `onRefresh`. If they dismiss or the token
 * expires, the consumer should handle the redirect (the api-client's 401
 * interceptor will do this automatically on the next request).
 */
export function useSessionExpiryWarning({
  onRefresh,
  enabled = true,
}: UseSessionExpiryWarningOptions) {
  const warningShownRef = useRef(false);
  const promptRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (promptRef.current !== null) {
      clearTimeout(promptRef.current);
      promptRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function schedulePrompt() {
      clearTimer();

      const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token) return;

      const remainingMs = getTokenExpiryMs(token);
      if (remainingMs === null || remainingMs <= 0) return;

      const delayMs = Math.max(remainingMs - WARNING_BEFORE_MS, 0);

      promptRef.current = setTimeout(() => {
        if (warningShownRef.current) return;
        warningShownRef.current = true;

        // Simple confirm dialog — can be replaced with a custom UI later
        const staySignedIn = window.confirm(
          "Your session is about to expire. Stay signed in?",
        );

        if (staySignedIn) {
          onRefresh()
            .then(() => {
              warningShownRef.current = false;
              schedulePrompt();
            })
            .catch(() => {
              // Refresh failed — api-client will redirect on next 401
            });
        }
      }, delayMs);
    }

    schedulePrompt();

    return clearTimer;
  }, [enabled, onRefresh, clearTimer]);
}
