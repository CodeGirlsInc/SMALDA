"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AnalyticsTrendPoint } from "@/lib/admin/types";

export default function TrendsLineChart({ trends }: { trends: AnalyticsTrendPoint[] }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm h-[320px]">
      <div className="mb-3">
        <h2 className="font-semibold">Trends Over Time</h2>
        <p className="text-sm text-gray-600">Users, documents and verifications</p>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trends}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />

          <Line type="monotone" dataKey="users" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="documents" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="verifications" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
