import { RecentVerification } from "@/lib/admin/types";

export default function RecentVerifications({
  items,
}: {
  items: RecentVerification[];
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm h-[320px] overflow-auto">
      <div className="mb-3">
        <h2 className="font-semibold">Recent Verifications</h2>
        <p className="text-sm text-gray-600">Latest verification activity</p>
      </div>

      <ul className="space-y-2">
        {items.slice(0, 20).map((v) => (
          <li key={v.id} className="border rounded-xl p-3">
            <p className="text-sm font-medium">{v.userEmail}</p>
            <p className="text-xs text-gray-600">
              Doc: {v.documentId} • {v.status.toUpperCase()}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {new Date(v.verifiedAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
