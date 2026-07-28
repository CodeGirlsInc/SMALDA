import Skeleton from "@/components/Skeleton";

export default function AdminLoading() {
  return (
    <main className="p-6 space-y-6" role="status" aria-label="Loading admin page">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    </main>
  );
}
