'use client';

interface StatusBadgeProps {
  status: string;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ANALYZING: 'bg-blue-100 text-blue-800',
  VERIFIED: 'bg-green-100 text-green-800',
  FLAGGED: 'bg-orange-100 text-orange-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {status}
    </span>
  );
}