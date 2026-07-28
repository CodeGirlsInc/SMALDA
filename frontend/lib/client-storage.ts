const SENSITIVE_KEYS = ["token", "access_token", "refresh_token", "auth_token", "session"];

export function setSafeItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function getSafeItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function removeSafeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}

export function clearSensitiveStorage(): void {
  try {
    for (const key of SENSITIVE_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    // Also remove any keys that look like tokens
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (key.includes("token") || key.includes("auth") || key.includes("session")) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.clear();
  } catch {
    // Silently fail
  }
}
