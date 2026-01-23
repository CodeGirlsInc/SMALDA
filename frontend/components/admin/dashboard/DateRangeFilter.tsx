"use client";

export default function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">From</label>
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="border rounded-lg px-2 py-1 text-sm"
      />

      <label className="text-sm text-gray-600">To</label>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="border rounded-lg px-2 py-1 text-sm"
      />
    </div>
  );
}
