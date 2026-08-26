import * as React from "react";
import { cn } from "@/lib/utils";

export interface RiskGaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Risk score on a 0–100 scale. */
  riskScore: number;
  /** Optional human-readable risk flags to list beneath the gauge. */
  riskFlags?: string[];
}

function scoreColor(score: number): string {
  if (score >= 70) return "#ef4444"; // red — high risk
  if (score >= 40) return "#eab308"; // yellow — medium risk
  return "#22c55e"; // green — low risk
}

function scoreLabel(score: number): string {
  if (score >= 70) return "High risk";
  if (score >= 40) return "Medium risk";
  return "Low risk";
}

/**
 * Circular/arc risk-score gauge rendered as inline SVG (no charting
 * dependency). Colour-banded green/yellow/red by score range, with a
 * text-equivalent of the score for screen readers (FE-55).
 */
const RiskGauge = React.forwardRef<HTMLDivElement, RiskGaugeProps>(
  ({ riskScore, riskFlags = [], className, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, riskScore));
    const color = scoreColor(clamped);
    const label = scoreLabel(clamped);

    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const filled = (clamped / 100) * circumference;

    return (
      <div
        ref={ref}
        className={cn("inline-flex flex-col items-center", className)}
        {...props}
      >
        {/* Text equivalent for screen readers — not just a visual gauge. */}
        <p className="sr-only">
          {label}: {clamped} out of 100.
        </p>

        <div className="relative h-32 w-32" aria-hidden="true">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="12"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{clamped}</span>
            <span className="text-xs text-gray-500">/ 100</span>
          </div>
        </div>

        <p
          role="status"
          className="mt-1 text-sm font-semibold"
          style={{ color }}
        >
          {label}
        </p>

        {riskFlags.length > 0 && (
          <ul className="mt-3 w-full space-y-1.5 text-left">
            {riskFlags.map((flag) => (
              <li
                key={flag}
                className="flex items-start gap-2 text-xs text-gray-600"
              >
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400"
                  aria-hidden="true"
                />
                {flag}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);
RiskGauge.displayName = "RiskGauge";

export { RiskGauge };
