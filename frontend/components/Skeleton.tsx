"use client";

import { useEffect, useState } from "react";

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export default function Skeleton({ className = "", width, height }: SkeletonProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`rounded bg-gray-200 ${prefersReducedMotion ? "" : "animate-pulse"} ${className}`}
      style={{ width, height }}
    >
      <span className="sr-only">Loading…</span>
    </div>
  );
}
