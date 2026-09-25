"use client";

import { useCallback, useEffect, useRef } from "react";
import { clearSession } from "@/lib/api-client";
import { clearLastViewedParcel } from "@/lib/map-state";

const ACCESS_TOKEN_KEY = "auth-token";
const WARNING_BEFORE_MS = 5 * 60 * 1000;
const ACTIVITY_GRACE_MS = 60 * 1000;
const ACTIVITY_DEBOUNCE_MS = 250;
const ACTIVITY_EVENTS = [
  "keydown",
  "beforeinput",
  "input",
  "focusin",
  "pointerdown",
  "mousedown",
  "click",
] as const;

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (normalized.length % 4)) % 4;
    const binary = atob(normalized + "=".repeat(padding));
    if (typeof TextDecoder === "undefined") return binary;
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(token: string): number | null {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return null;
  const decoded = decodeBase64Url(payloadPart);
  if (!decoded) return null;

  try {
    const payload: unknown = JSON.parse(decoded);
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("exp" in payload) ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp)
    ) {
      return null;
    }
    return payload.exp * 1000 - Date.now();
  } catch {
    return null;
  }
}

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.getAttribute("role") === "textbox"
  );
}

export function initCrossTabLogoutSync(): () => void {
  if (typeof window === "undefined") return () => {};

  function handler(event: StorageEvent) {
    if (event.key === "logout-event" && event.newValue) {
      clearSession({ notify: false });
      clearLastViewedParcel();
      window.location.href = "/login";
    }
  }

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export interface UseSessionExpiryWarningOptions {
  onRefresh?: () => Promise<void>;
  enabled?: boolean;
}

export function useSessionExpiryWarning({
  onRefresh,
  enabled = true,
}: UseSessionExpiryWarningOptions) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const warningTokenRef = useRef<string | null>(null);
  const warningShownRef = useRef(false);
  const promptRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityAtRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (promptRef.current !== null) {
      clearTimeout(promptRef.current);
      promptRef.current = null;
    }
    if (activityDebounceRef.current !== null) {
      clearTimeout(activityDebounceRef.current);
      activityDebounceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let disposed = false;
    warningShownRef.current = false;
    lastActivityAtRef.current = null;
    const listenerOptions: AddEventListenerOptions = { capture: true };

    function schedulePrompt(
      afterActivity = false,
      activityAt?: number,
    ) {
      if (promptRef.current !== null) {
        clearTimeout(promptRef.current);
        promptRef.current = null;
      }
      if (disposed) return;

      const token = readAccessToken();
      if (!token) return;
      if (warningTokenRef.current !== token) {
        warningTokenRef.current = token;
        warningShownRef.current = false;
      }
      if (warningShownRef.current) return;

      const now = Date.now();
      const currentRemainingMs = getTokenExpiryMs(token);
      if (currentRemainingMs === null || currentRemainingMs <= 0) return;
      const remainingAtReference =
        currentRemainingMs +
        (afterActivity && activityAt !== undefined
          ? Math.max(0, now - activityAt)
          : 0);
      if (remainingAtReference <= 0) return;
      const warningDelayAtReference = Math.max(
        remainingAtReference - WARNING_BEFORE_MS,
        0,
      );
      const delayMs = afterActivity
        ? Math.min(
            remainingAtReference,
            warningDelayAtReference + ACTIVITY_GRACE_MS,
          )
        : warningDelayAtReference;

      promptRef.current = setTimeout(() => {
        promptRef.current = null;
        if (disposed) return;

        const currentToken = readAccessToken();
        if (currentToken !== token) {
          warningTokenRef.current = null;
          warningShownRef.current = false;
          lastActivityAtRef.current = null;
          schedulePrompt();
          return;
        }
        if (warningShownRef.current) return;
        warningTokenRef.current = token;
        warningShownRef.current = true;

        let staySignedIn = false;
        try {
          staySignedIn = window.confirm(
            "Your session is about to expire. Stay signed in?",
          );
        } catch {
          return;
        }
        if (!staySignedIn) return;

        const refresh = onRefreshRef.current;
        if (!refresh) return;
        Promise.resolve()
          .then(() => refresh())
          .then(() => {
            if (disposed) return;
            warningTokenRef.current = null;
            warningShownRef.current = false;
            schedulePrompt();
          })
          .catch(() => {
            if (disposed) return;
            warningTokenRef.current = null;
            warningShownRef.current = false;
            schedulePrompt(true);
          });
      }, delayMs);
    }

    function handleActivity(event: Event) {
      const activeElement = document.activeElement;
      const editingEvent =
        isEditingTarget(event.target) ||
        ((event.type === "click" ||
          event.type === "pointerdown" ||
          event.type === "mousedown") &&
          isEditingTarget(activeElement));
      if (!editingEvent) return;

      const activityAt = Date.now();
      lastActivityAtRef.current = activityAt;
      if (promptRef.current !== null) {
        clearTimeout(promptRef.current);
        promptRef.current = null;
      }
      if (activityDebounceRef.current !== null) {
        clearTimeout(activityDebounceRef.current);
      }
      activityDebounceRef.current = setTimeout(() => {
        activityDebounceRef.current = null;
        schedulePrompt(true, lastActivityAtRef.current ?? activityAt);
      }, ACTIVITY_DEBOUNCE_MS);
    }

    schedulePrompt();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, listenerOptions);
    });

    return () => {
      disposed = true;
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity, listenerOptions);
      });
      lastActivityAtRef.current = null;
      clearTimers();
    };
  }, [enabled, clearTimers]);
}
