"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "smalda-theme";

interface ThemeContextValue {
  /** The user-selected theme preference (may be "system") */
  theme: Theme;
  /** The resolved theme actually applied to the DOM ("light" or "dark") */
  resolvedTheme: ResolvedTheme;
  /** Set the theme preference explicitly */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Reads the OS-level color-scheme preference.
 */
function getSystemPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Reads the persisted theme from localStorage (if any).
 */
function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (SSR, privacy mode, etc.)
  }
  return null;
}

/**
 * Resolves the effective theme from a preference.
 */
function resolveTheme(preference: Theme): ResolvedTheme {
  if (preference === "system") return getSystemPreference();
  return preference;
}

/**
 * Applies the resolved theme to the DOM by toggling the `.dark` class
 * on the <html> element.
 */
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Optional override for the initial theme (useful for SSR / tests) */
  defaultTheme?: Theme;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // ── Initialise from localStorage / OS preference ───────────────────────
  useEffect(() => {
    const stored = getStoredTheme();
    const initial: Theme = stored ?? defaultTheme;
    const resolved = resolveTheme(initial);

    setThemeState(initial);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for OS preference changes when theme is "system" ────────────
  useEffect(() => {
    if (theme !== "system") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const resolved: ResolvedTheme = e.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  // ── setTheme callback ──────────────────────────────────────────────────
  const setTheme = useCallback((newTheme: Theme) => {
    const resolved = resolveTheme(newTheme);
    setThemeState(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, []);

  // ── toggleTheme callback ───────────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook to access the current theme state and controls.
 *
 * Must be used inside a `<ThemeProvider>`.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a <ThemeProvider>");
  }
  return ctx;
}

// ─── Exported helpers (useful for scripts / SSR) ─────────────────────────────

/**
 * Returns an inline script that reads the stored theme from localStorage
 * and applies the `.dark` class synchronously to avoid FOUC.
 * Drop this into the `<head>` of your root layout.
 */
export function getThemeScript(): string {
  return `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;
}
