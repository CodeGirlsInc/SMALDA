"use client";

import React, { useEffect, useState } from "react";

interface RiskGaugeProps {
  score: number;
  size?: number;
}

type RiskLevel = "Low Risk" | "Medium Risk" | "High Risk";

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 29) return "Low Risk";
  if (score <= 59) return "Medium Risk";
  return "High Risk";
}

function getRiskColor(score: number): string {
  if (score <= 29) return "#22c55e"; // green-500
  if (score <= 59) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

export default function RiskGauge({ score, size = 200 }: RiskGaugeProps) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(Math.min(Math.max(score, 0), 100)), 50);
    return () => clearTimeout(timer);
  }, [score]);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 24) / 2;
  // Semicircle: from 180° to 0° (left to right across the bottom half)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startAngle = 180;
  const endAngle = 0;
  const totalAngle = 180;

  const arcPath = (from: number, to: number) => {
    const s = { x: cx + r * Math.cos(toRad(from)), y: cy + r * Math.sin(toRad(from)) };
    const e = { x: cx + r * Math.cos(toRad(to)), y: cy + r * Math.sin(toRad(to)) };
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const filledAngle = startAngle - (animated / 100) * totalAngle;
  const circumference = Math.PI * r; // half circle arc length
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (animated / 100) * circumference;

  const label = getRiskLevel(score);
  const color = getRiskColor(score);

  return (
    <div className="flex flex-col items-center" role="img" aria-label={`Risk gauge: ${score} - ${label}`}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`} overflow="visible">
        {/* Track */}
        <path
          d={arcPath(startAngle, endAngle)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={arcPath(startAngle, endAngle)}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out, stroke 0.4s ease" }}
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={size * 0.18}
          fontWeight="bold"
          fill="currentColor"
        >
          {score}
        </text>
      </svg>
      <span className="mt-1 text-sm font-semibold" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
