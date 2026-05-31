"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";

const FLAG_META: Record<string, { label: string; description: string }> = {
  MISSING_PARCEL_ID: {
    label: "Missing Parcel ID",
    description: "The document does not contain a valid parcel identifier.",
  },
  DUPLICATE_TITLE: {
    label: "Duplicate Title",
    description: "A document with the same title already exists in the system.",
  },
  INVALID_BOUNDARY: {
    label: "Invalid Boundary",
    description: "The land boundary coordinates are inconsistent or invalid.",
  },
  FORGED_SIGNATURE: {
    label: "Forged Signature",
    description: "The document signature appears to be forged or tampered with.",
  },
  MISSING_OWNER_INFO: {
    label: "Missing Owner Info",
    description: "Owner identification details are absent from the document.",
  },
  EXPIRED_DOCUMENT: {
    label: "Expired Document",
    description: "The document has passed its validity date.",
  },
  CONFLICTING_OWNERSHIP: {
    label: "Conflicting Ownership",
    description: "Multiple ownership claims exist for the same parcel.",
  },
};

function toLabel(flag: string): string {
  return (
    FLAG_META[flag]?.label ??
    flag
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function toDescription(flag: string): string {
  return FLAG_META[flag]?.description ?? `Risk flag: ${flag}`;
}

interface FlagChipProps {
  flag: string;
}

function FlagChip({ flag }: FlagChipProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-describedby={`tooltip-${flag}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((v) => !v);
        }}
        className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {toLabel(flag)}
      </button>

      {open && (
        <div
          role="tooltip"
          id={`tooltip-${flag}`}
          className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
        >
          {toDescription(flag)}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

interface RiskFlagsDisplayProps {
  flags?: string[] | null;
}

export default function RiskFlagsDisplay({ flags }: RiskFlagsDisplayProps) {
  if (flags == null) {
    return (
      <p className="text-sm text-gray-400">Not yet assessed</p>
    );
  }

  if (flags.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
        <CheckCircle className="h-4 w-4" aria-hidden="true" />
        No flags detected
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((flag) => (
        <FlagChip key={flag} flag={flag} />
      ))}
    </div>
  );
}
