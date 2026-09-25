"use client";

import { useEffect, type ReactNode } from "react";

const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

export function SystemThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia(DARK_MODE_QUERY);

    const applyTheme = () => {
      document.documentElement.classList.toggle("dark", media.matches);
      document.documentElement.style.colorScheme = media.matches
        ? "dark"
        : "light";
    };

    applyTheme();
    media.addEventListener("change", applyTheme);

    return () => media.removeEventListener("change", applyTheme);
  }, []);

  return <>{children}</>;
}
