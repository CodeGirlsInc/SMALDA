"use client";

type StatusSize = "sm" | "md";

interface StatusBadgeProps {
  status: string;
  size?: StatusSize;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  ANALYZING: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-green-100 text-green-700",
  FLAGGED: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
  OPEN: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-green-100 text-green-700",
};

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600";
  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  const label = toTitleCase(status);

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center rounded-full font-medium ${style} ${sizeClass}`}
    >
      {label}
    </span>
  );
}
