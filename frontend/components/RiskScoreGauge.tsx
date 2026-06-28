'use client';

interface Props {
  score: number;
  size?: number;
}

export default function RiskScoreGauge({ score, size = 120 }: Props) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score < 30 ? '#22c55e' : score < 60 ? '#eab308' : score < 80 ? '#f97316' : '#ef4444';

  const label =
    score < 30 ? 'Low Risk' : score < 60 ? 'Medium' : score < 80 ? 'High Risk' : 'Critical';

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="46" textAnchor="middle" className="text-lg font-bold" fill="currentColor">
          {score}%
        </text>
        <text x="50" y="62" textAnchor="middle" fontSize="8" fill="#6b7280">
          Risk
        </text>
      </svg>
      <p className="mt-1 text-sm font-medium" style={{ color }}>{label}</p>
    </div>
  );
}
