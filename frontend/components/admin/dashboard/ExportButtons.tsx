"use client";

import { AdminAnalyticsResponse } from "@/lib/admin/types";
import { exportAnalyticsCSV, exportAnalyticsPDF } from "@/lib/admin/export";

export default function ExportButtons({ data }: { data: AdminAnalyticsResponse }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportAnalyticsCSV(data)}
        className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
      >
        Export CSV
      </button>

      <button
        onClick={() => exportAnalyticsPDF(data)}
        className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
      >
        Export PDF
      </button>
    </div>
  );
}
