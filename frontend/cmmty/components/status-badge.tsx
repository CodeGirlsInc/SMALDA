"use client";

import React from "react";
import { DocumentStatus } from "../types/document";

interface StatusBadgeProps {
  status: DocumentStatus;
}

const statusConfig: Record<
  DocumentStatus,
  { label: string; className: string }
> = {
  [DocumentStatus.PENDING]: {
    label: "Pending",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  [DocumentStatus.ANALYZING]: {
    label: "Analyzing",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  [DocumentStatus.VERIFIED]: {
    label: "Verified",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  [DocumentStatus.FLAGGED]: {
    label: "Flagged",
    className:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  },
  [DocumentStatus.REJECTED]: {
    label: "Rejected",
    className: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
