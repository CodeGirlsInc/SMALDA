"use client";

import { useMemo, useState } from "react";
import { UserActivityRow } from "@/lib/admin/types";

type SortKey = "name" | "email" | "lastActiveAt" | "actionsCount";
type SortDir = "asc" | "desc";

export default function UserActivityTable({ rows }: { rows: UserActivityRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("actionsCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortDir === "asc" ? -1 : 1;
      if (strA > strB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(next: SortKey) {
    if (next === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(next);
      setSortDir("asc");
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm overflow-x-auto">
      <div className="mb-3">
        <h2 className="font-semibold">User Activity</h2>
        <p className="text-sm text-gray-600">Sortable activity table</p>
      </div>

      <table className="min-w-[900px] w-full text-sm" role="table">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="py-2">
              <button
                className="hover:underline"
                onClick={() => toggleSort("name")}
                aria-label="Sort by name"
              >
                Name
              </button>
            </th>

            <th className="py-2">
              <button
                className="hover:underline"
                onClick={() => toggleSort("email")}
                aria-label="Sort by email"
              >
                Email
              </button>
            </th>

            <th className="py-2">
              <button
                className="hover:underline"
                onClick={() => toggleSort("lastActiveAt")}
                aria-label="Sort by last active"
              >
                Last Active
              </button>
            </th>

            <th className="py-2 text-right">
              <button
                className="hover:underline"
                onClick={() => toggleSort("actionsCount")}
                aria-label="Sort by actions count"
              >
                Actions
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          {sorted.slice(0, 200).map((u) => (
            <tr key={u.userId} className="border-t">
              <td className="py-3 font-medium">{u.name}</td>
              <td className="py-3 text-gray-700">{u.email}</td>
              <td className="py-3 text-gray-600">
                {new Date(u.lastActiveAt).toLocaleString()}
              </td>
              <td className="py-3 text-right font-medium">
                {u.actionsCount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-gray-500 mt-3">
        Showing up to 200 records (performance-friendly for large datasets).
      </p>
    </div>
  );
}
