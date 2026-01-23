import { AdminAnalyticsResponse } from "@/lib/admin/types";

export async function fetchAdminAnalytics(from: string, to: string) {
  const res = await fetch(`/api/admin/analytics?from=${from}&to=${to}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch admin analytics");
  }

  return (await res.json()) as AdminAnalyticsResponse;
}
