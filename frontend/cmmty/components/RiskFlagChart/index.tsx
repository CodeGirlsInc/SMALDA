"use client";

import React from "react";

export interface RiskFlag {
  id: string;
  name: string;
  weight: number;
}

export const getFlagLevel = (weight: number, total: number) => {
  if (total <= 0) return "low";
  const share = weight / total;
  if (share > 0.66) return "high";
  if (share > 0.33) return "medium";
  return "low";
};

export const getBarWidth = (weight: number, total: number) => {
  if (total <= 0 || weight <= 0) return "0%";
  return `${Math.round((weight / total) * 100)}%`;
};

interface RiskFlagChartProps {
  flags: RiskFlag[];
}

const levelStyles: Record<string, string> = {
  low: "bg-gray-300 text-gray-900",
  medium: "bg-amber-400 text-amber-950",
  high: "bg-red-500 text-white",
};

export default function RiskFlagChart({ flags }: RiskFlagChartProps) {
  const totalScore = flags.reduce((sum, flag) => sum + Math.max(flag.weight, 0), 0);

  if (flags.length === 0 || totalScore === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
        No risk flags detected.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flags.map((flag) => {
        const width = getBarWidth(flag.weight, totalScore);
        const level = getFlagLevel(flag.weight, totalScore);
        const barClasses = levelStyles[level] ?? levelStyles.low;

        return (
          <div key={flag.id} className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium text-gray-800">
              <span>{flag.name}</span>
              <span>{flag.weight} pts</span>
            </div>
            <div className="h-10 overflow-hidden rounded-full bg-gray-200">
              <div
                role="progressbar"
                aria-label={`${flag.name} contributes ${width} of total risk`}
                aria-valuenow={flag.weight}
                aria-valuemin={0}
                aria-valuemax={totalScore}
                className={`h-full rounded-full ${barClasses} transition-all duration-300 ease-out`}
                style={{ width }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
