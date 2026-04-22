"use client";

import React from "react";

interface RiskGaugeProps {
  score?: number;
  size?: number;
  strokeWidth?: number;
}

export default function RiskGauge({
  score,
  size = 160,
  strokeWidth = 14,
}: RiskGaugeProps) {
  if (score === undefined || score === null) {
    return (
      <div className="flex flex-col items-center justify-center">
        <span className="text-sm text-muted-foreground">No risk data</span>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const dashOffset = circumference - (clampedScore / 100) * circumference;

  let colorClass = "text-emerald-500";
  let label = "Low Risk";
  if (score >= 70) {
    colorClass = "text-rose-500";
    label = "Critical Risk";
  } else if (score >= 40) {
    colorClass = "text-amber-500";
    label = "High Risk";
  } else if (score >= 20) {
    colorClass = "text-yellow-500";
    label = "Medium Risk";
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={`${colorClass} transition-all duration-700 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <span className={`mt-2 text-sm font-semibold ${colorClass}`}>
        {label}
      </span>
    </div>
  );
}
