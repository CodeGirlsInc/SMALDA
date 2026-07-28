import Skeleton from "@/components/Skeleton";

export default function ReportsLoading() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6" role="status" aria-label="Loading reports">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </main>
  );
}
