"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { RiskDistributionItem } from "@/lib/admin/types";

export default function RiskBarChart({
  distribution,
}: {
  distribution: RiskDistributionItem[];
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm h-[320px]">
      <div className="mb-3">
        <h2 className="font-semibold">Document Risk Distribution</h2>
        <p className="text-sm text-gray-600">Low / medium / high risk counts</p>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={distribution}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="risk" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
