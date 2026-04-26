"use client";

import { useState, useEffect } from "react";

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";

const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  if (width >= BREAKPOINTS.sm) return "sm";
  return "xs";
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("md");
  const [width, setWidth] = useState<number>(1024);

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      setWidth(w);
      setBreakpoint(getBreakpoint(w));
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    breakpoint,
    width,
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
  };
}

export { BREAKPOINTS };
