"use client";

import React from "react";

export type SkeletonVariant = "text" | "circular" | "rectangular";

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
  animation?: "pulse" | "wave" | "none";
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: "rounded",
  circular: "rounded-full",
  rectangular: "rounded-md",
};

const animationClasses: Record<string, string> = {
  pulse: "animate-pulse",
  wave: "animate-pulse", // simplified; wave requires custom keyframes
  none: "",
};

export default function Skeleton({
  variant = "text",
  width,
  height,
  className,
  animation = "pulse",
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`bg-gray-200 ${variantClasses[variant]} ${animationClasses[animation]} ${className ?? ""}`}
      style={style}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
