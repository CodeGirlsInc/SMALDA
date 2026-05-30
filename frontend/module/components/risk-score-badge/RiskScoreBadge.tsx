"use client";

type Size = "sm" | "md" | "lg";

interface RiskScoreBadgeProps {
  score?: number | null;
  size?: Size;
}

function getLevel(score: number): { label: string; bg: string; text: string } {
  if (score < 30) return { label: "LOW", bg: "bg-green-100", text: "text-green-700" };
  if (score < 70) return { label: "MEDIUM", bg: "bg-amber-100", text: "text-amber-700" };
  return { label: "HIGH", bg: "bg-red-100", text: "text-red-700" };
}

const SIZE_CLASSES: Record<Size, { circle: string; score: string; label: string }> = {
  sm: { circle: "h-10 w-10 text-sm", score: "text-sm font-bold", label: "text-xs mt-1" },
  md: { circle: "h-14 w-14 text-base", score: "text-base font-bold", label: "text-xs mt-1" },
  lg: { circle: "h-20 w-20 text-xl", score: "text-xl font-bold", label: "text-sm mt-1.5" },
};

export default function RiskScoreBadge({ score, size = "md" }: RiskScoreBadgeProps) {
  const sz = SIZE_CLASSES[size];

  if (score == null) {
    return (
      <div className="flex flex-col items-center">
        <div
          className={`flex items-center justify-center rounded-full bg-gray-100 ${sz.circle}`}
          aria-label="Risk score not available"
        >
          <span className={`${sz.score} text-gray-400`}>â€”</span>
        </div>
        <span className={`${sz.label} text-gray-400`}>N/A</span>
      </div>
    );
  }

  const { label, bg, text } = getLevel(score);

  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex items-center justify-center rounded-full ${bg} ${sz.circle}`}
        aria-label={`Risk score ${score}, level ${label}`}
        role="img"
      >
        <span className={`${sz.score} ${text}`}>{score}</span>
      </div>
      <span className={`${sz.label} font-medium ${text}`}>{label}</span>
    </div>
  );
}
