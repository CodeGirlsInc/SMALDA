import { SystemHealth as SystemHealthType } from "@/lib/admin/types";

function pill(status: string) {
  const base = "text-xs font-medium px-2 py-1 rounded-full";
  if (status === "healthy") return `${base} bg-green-100 text-green-700`;
  if (status === "degraded") return `${base} bg-yellow-100 text-yellow-700`;
  return `${base} bg-red-100 text-red-700`;
}

export default function SystemHealth({ health }: { health: SystemHealthType }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm h-[320px]">
      <h2 className="font-semibold">System Health</h2>
      <p className="text-sm text-gray-600 mb-4">Live service status indicators</p>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">API Status</span>
          <span className={pill(health.apiStatus)}>{health.apiStatus}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">DB Status</span>
          <span className={pill(health.dbStatus)}>{health.dbStatus}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Latency</span>
          <span className="text-sm font-medium">{health.latencyMs}ms</span>
        </div>
      </div>
    </div>
  );
}
