"use client";

import React from "react";

interface RiskScoreProps {
  score?: number;
}

export default function RiskScore({ score }: RiskScoreProps) {
  if (score === undefined || score === null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  let colorClass = "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) {
    colorClass = "text-rose-600 dark:text-rose-400";
  } else if (score >= 40) {
    colorClass = "text-amber-600 dark:text-amber-400";
  } else if (score >= 20) {
    colorClass = "text-yellow-600 dark:text-yellow-400";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${
            score >= 70
              ? "bg-rose-500"
              : score >= 40
                ? "bg-amber-500"
                : score >= 20
                  ? "bg-yellow-500"
                  : "bg-emerald-500"
          }`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className={`text-sm font-medium ${colorClass}`}>{score}</span>
    </div>
  );
}
