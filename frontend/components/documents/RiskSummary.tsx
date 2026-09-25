'use client';

interface RiskSummaryProps {
  score: number | null;
  flags: string[] | null;
}

export function RiskSummary({ score, flags }: RiskSummaryProps) {
  if (score === null) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
        <p className="text-sm text-gray-500">Risk analysis not yet available.</p>
      </div>
    );
  }

  const getRiskColor = (score: number) => {
    if (score < 30) return { stroke: '#22c55e', text: 'text-green-600', label: 'Low Risk' };
    if (score < 60) return { stroke: '#f59e0b', text: 'text-amber-500', label: 'Medium Risk' };
    return { stroke: '#ef4444', text: 'text-red-600', label: 'High Risk' };
  };

  const { stroke, text, label } = getRiskColor(score);
  const R = 52;
  const circumference = 2 * Math.PI * R;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Risk Analysis</h2>
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex flex-col items-center gap-2">
          <svg width="128" height="128" viewBox="0 0 128 128" aria-label={`Risk score: ${score} out of 100`} role="img">
            <circle cx="64" cy="64" r={R} fill="none" stroke="#e5e7eb" strokeWidth="12" />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke={stroke}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 64 64)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text x="64" y="60" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold" fill="currentColor" style={{ fontSize: 26, fontWeight: 700 }}>
              {score}
            </text>
            <text x="64" y="84" textAnchor="middle" dominantBaseline="middle" fill="#6b7280" style={{ fontSize: 11 }}>
              / 100
            </text>
          </svg>
          <p className={`text-sm font-semibold ${text}`}>{label}</p>
        </div>
        <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {flags?.map((flag) => (
            <div key={flag} className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-800">{flag}</span>
                <span className="text-lg text-red-500" aria-label="Detected">✗</span>
              </div>
            </div>
          ))}
          {(!flags || flags.length === 0) && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">No risk flags detected</span>
                <span className="text-lg text-green-500" aria-label="Not detected">✓</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}