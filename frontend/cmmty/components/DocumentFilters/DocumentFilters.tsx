"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export type DocumentStatus = "ALL" | "PENDING" | "ANALYZING" | "VERIFIED" | "FLAGGED" | "REJECTED";

export interface FilterState {
  search: string;
  status: DocumentStatus;
  dateFrom: string;
  dateTo: string;
}

interface DocumentFiltersProps {
  onChange?: (filters: FilterState) => void;
  debounceMs?: number;
}

const STATUS_OPTIONS: DocumentStatus[] = ["ALL", "PENDING", "ANALYZING", "VERIFIED", "FLAGGED", "REJECTED"];

const EMPTY: FilterState = { search: "", status: "ALL", dateFrom: "", dateTo: "" };

export default function DocumentFilters({ onChange, debounceMs = 300 }: DocumentFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCount = [
    filters.search !== "",
    filters.status !== "ALL",
    filters.dateFrom !== "",
    filters.dateTo !== "",
  ].filter(Boolean).length;

  const update = (patch: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange?.(next), debounceMs);
      return next;
    });
  };

  // Flush on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const clearAll = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFilters(EMPTY);
    onChange?.(EMPTY);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
      {/* Search input */}
      <div className="relative flex-1 min-w-48">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search documents…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Search documents"
        />
      </div>

      {/* Status dropdown */}
      <select
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as DocumentStatus })}
        className="py-2 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s === "ALL" ? "All Statuses" : s}
          </option>
        ))}
      </select>

      {/* Date range */}
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => update({ dateFrom: e.target.value })}
        className="py-2 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="From date"
      />
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => update({ dateTo: e.target.value })}
        className="py-2 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="To date"
      />

      {/* Active filter badge + clear */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold" aria-label={`${activeCount} active filters`}>
            {activeCount}
          </span>
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500"
            aria-label="Clear all filters"
          >
            <X size={14} />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
