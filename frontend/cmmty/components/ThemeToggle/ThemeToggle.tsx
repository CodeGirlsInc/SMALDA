"use client";

import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "./useTheme";

interface ThemeToggleProps {
  /** Visual variant: "icon" (single button) or "segmented" (3-way control) */
  variant?: "icon" | "segmented";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Animated theme toggle button.
 *
 * - **"icon"** variant: Single button that cycles light → dark → system.
 *   Shows Sun / Moon / Monitor icon with a rotate + scale transition.
 * - **"segmented"** variant: Three-button segmented control.
 */
export default function ThemeToggle({
  variant = "icon",
  className = "",
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === "segmented") {
    return (
      <div
        className={`inline-flex rounded-lg border border-border bg-muted p-1 gap-0.5 ${className}`}
        role="radiogroup"
        aria-label="Color theme"
      >
        <SegmentButton
          active={theme === "light"}
          onClick={() => setTheme("light")}
          label="Light"
        >
          <Sun size={16} className="transition-transform duration-300" />
        </SegmentButton>
        <SegmentButton
          active={theme === "dark"}
          onClick={() => setTheme("dark")}
          label="Dark"
        >
          <Moon size={16} className="transition-transform duration-300" />
        </SegmentButton>
        <SegmentButton
          active={theme === "system"}
          onClick={() => setTheme("system")}
          label="System"
        >
          <Monitor size={16} className="transition-transform duration-300" />
        </SegmentButton>
      </div>
    );
  }

  // ── Icon variant ──────────────────────────────────────────────────────
  const iconMap: Record<Theme, React.ReactNode> = {
    light: (
      <Sun
        size={20}
        className="transition-all duration-300 rotate-0 scale-100"
      />
    ),
    dark: (
      <Moon
        size={20}
        className="transition-all duration-300 rotate-0 scale-100"
      />
    ),
    system: (
      <Monitor
        size={20}
        className="transition-all duration-300 rotate-0 scale-100"
      />
    ),
  };

  const labelMap: Record<Theme, string> = {
    light: "Switch to dark mode",
    dark: "Switch to system preference",
    system: "Switch to light mode",
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-foreground hover:bg-muted active:bg-accent transition-colors ${className}`}
      aria-label={labelMap[theme]}
      title={`Current: ${resolvedTheme} (${theme})`}
    >
      <span className="relative h-5 w-5">
        {/* All icons are rendered; inactive ones are hidden with opacity + transforms */}
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            theme === "light"
              ? "opacity-100 rotate-0 scale-100"
              : "opacity-0 rotate-90 scale-50"
          }`}
          aria-hidden={theme !== "light"}
        >
          <Sun size={20} />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            theme === "dark"
              ? "opacity-100 rotate-0 scale-100"
              : "opacity-0 -rotate-90 scale-50"
          }`}
          aria-hidden={theme !== "dark"}
        >
          <Moon size={20} />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            theme === "system"
              ? "opacity-100 rotate-0 scale-100"
              : "opacity-0 rotate-90 scale-50"
          }`}
          aria-hidden={theme !== "system"}
        >
          <Monitor size={20} />
        </span>
      </span>
    </button>
  );
}

// ─── Segmented control button ────────────────────────────────────────────────

interface SegmentButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function SegmentButton({ active, onClick, label, children }: SegmentButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 min-h-[36px] min-w-[44px] px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
