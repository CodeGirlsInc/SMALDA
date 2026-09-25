interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export default function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`rounded bg-gray-200 motion-safe:animate-pulse motion-reduce:animate-none ${className}`}
      style={{ width, height }}
    >
      <span className="sr-only">Loading…</span>
    </div>
  );
}
