import { AnalyticsOverview } from "@/lib/admin/types";

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-semibold mt-2">{value.toLocaleString()}</p>
    </div>
  );
}

export default function OverviewCards({ overview }: { overview: AnalyticsOverview }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card label="Total Users" value={overview.totalUsers} />
      <Card label="Documents" value={overview.totalDocuments} />
      <Card label="Verifications" value={overview.totalVerifications} />
    </div>
  );
}
