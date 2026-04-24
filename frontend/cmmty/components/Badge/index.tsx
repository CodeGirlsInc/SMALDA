"use client";

import React from "react";
import { DocumentStatus } from "../../types/document";

export type BadgeSize = "sm" | "md";

interface BadgeProps {
  status: DocumentStatus;
  size?: BadgeSize;
  dot?: boolean;
}

const statusConfig: Record<DocumentStatus, { label: string; color: string; dot: string }> = {
  [DocumentStatus.PENDING]: {
    label: "Pending",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dot: "bg-gray-500",
  },
  [DocumentStatus.ANALYZING]: {
    label: "Analyzing",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  [DocumentStatus.VERIFIED]: {
    label: "Verified",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    dot: "bg-green-500",
  },
  [DocumentStatus.FLAGGED]: {
    label: "Flagged",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    dot: "bg-yellow-500",
  },
  [DocumentStatus.REJECTED]: {
    label: "Rejected",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    dot: "bg-red-500",
  },
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export default function Badge({ status, size = "md", dot = false }: BadgeProps) {
  const config = statusConfig[status];

  if (dot) {
    return (
      <span
        className={`inline-block rounded-full ${config.dot} ${size === "sm" ? "h-2 w-2" : "h-3 w-3"}`}
        aria-label={config.label}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.color} ${sizeClasses[size]}`}
    >
      <span className={`inline-block rounded-full ${config.dot} ${size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"}`} />
      {config.label}
    </span>
  );
}
