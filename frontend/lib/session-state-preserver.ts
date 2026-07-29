/**
 * Simple helper to preserve in-progress form and upload state across a
 * session-expiry redirect.
 *
 * Usage:
 *   // Before the redirect (e.g. in a form component):
 *   preserveSessionState("upload-form", { file: fileData, annotations: [...] });
 *
 *   // After login, restore:
 *   const saved = restoreSessionState<UploadState>("upload-form");
 *   if (saved) { /* repopulate form */ }
 *
 * State is stored in sessionStorage so it survives a redirect but is
 * automatically cleared when the tab is closed.
 */

const SESSION_STATE_PREFIX = "smalda-session-state:";

/**
 * Save in-progress state before a session-expiry redirect.
 * Serializes to JSON and stores in sessionStorage.
 */
export function preserveSessionState<T = unknown>(
  key: string,
  state: T,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${SESSION_STATE_PREFIX}${key}`,
      JSON.stringify(state),
    );
  } catch {
    // sessionStorage full or unavailable — best-effort only
  }
}

/**
 * Restore previously-saved state after login. Returns null if nothing was
 * saved under the given key. Clears the stored state after reading so it
 * isn't restored twice.
 */
export function restoreSessionState<T = unknown>(
  key: string,
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${SESSION_STATE_PREFIX}${key}`);
    if (!raw) return null;
    window.sessionStorage.removeItem(`${SESSION_STATE_PREFIX}${key}`);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
