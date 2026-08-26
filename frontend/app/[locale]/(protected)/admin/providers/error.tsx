"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/navigation";

export default function AdminProvidersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin providers route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900">Provider health unavailable</h1>
      <p className="max-w-md text-sm text-gray-500">
        Validation provider health could not be loaded. Other admin pages remain available.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Back to admin
        </Link>
      </div>
    </main>
  );
}
