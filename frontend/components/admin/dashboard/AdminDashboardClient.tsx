"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchAdminAnalytics } from "@/lib/admin/api";
import { defaultDateRange } from "@/lib/admin/utils";
import { AdminAnalyticsResponse } from "@/lib/admin/types";

import OverviewCards from "./OverviewCards";
import TrendsLineChart from "./TrendsLineChart";
import RiskBarChart from "./RiskBarChart";
import SystemHealth from "./SystemHealth";
import RecentVerifications from "./RecentVerifications";
import DateRangeFilter from "./DateRangeFilter";
import ExportButtons from "./ExportButtons";
import UserActivityTable from "./UserActivityTable";

export default function AdminDashboardClient() {
  const initial = useMemo(() => defaultDateRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const { data, isLoading, error, isFetching } = useQuery<AdminAnalyticsResponse>(
    ["admin-analytics", from, to],
    () => fetchAdminAnalytics(from, to),
    {
      // ✅ real-time updates (polling)
      refetchInterval: 10_000,
      keepPreviousData: true,
      staleTime: 5_000,
    }
  );

  if (isLoading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Failed to load analytics</h1>
        <p className="text-sm text-gray-600 mt-2">
          Please refresh or try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">
            System-wide analytics and verification metrics{" "}
            {isFetching ? "(Updating...)" : ""}
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <DateRangeFilter
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />
          <ExportButtons data={data} />
        </div>
      </div>

      <OverviewCards overview={data.overview} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <TrendsLineChart trends={data.trends} />
        </div>
        <SystemHealth health={data.systemHealth} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RiskBarChart distribution={data.riskDistribution} />
        <RecentVerifications items={data.recentVerifications} />
      </div>

      <UserActivityTable rows={data.userActivity} />
    </div>
  );
}
