"use client";

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius = "0.375rem",
  className = "",
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{ width, height, borderRadius }}
      className={`skeleton-shimmer bg-gray-200 ${className}`}
    >
      <style jsx>{`
        @media (prefers-reduced-motion: no-preference) {
          .skeleton-shimmer {
            background: linear-gradient(
              90deg,
              #e5e7eb 25%,
              #f3f4f6 50%,
              #e5e7eb 75%
            );
            background-size: 200% 100%;
            animation: shimmer 1.4s infinite;
          }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export function DocumentCardSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height="1rem" />
        <Skeleton width="40%" height="0.75rem" />
      </div>
      <Skeleton width="4rem" height="1.5rem" borderRadius="9999px" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <Skeleton width="6rem" height="0.875rem" />
      <Skeleton width="4rem" height="2rem" className="mt-2" />
    </div>
  );
}

interface TableRowSkeletonProps {
  columnCount?: number;
}

export function TableRowSkeleton({ columnCount = 4 }: TableRowSkeletonProps) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: columnCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton />
        </td>
      ))}
    </tr>
  );
}

export default Skeleton;
