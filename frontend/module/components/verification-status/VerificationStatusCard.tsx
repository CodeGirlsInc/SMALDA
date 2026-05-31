"use client";

import { CheckCircle, Clock, XCircle, HelpCircle } from "lucide-react";

interface VerificationRecord {
  status: "CONFIRMED" | "PENDING" | "FAILED";
  stellarTxHash: string;
  stellarLedger: number;
  anchoredAt: string;
}

interface StellarTransactionLinkProps {
  txHash: string;
  network?: "testnet" | "mainnet";
}

function StellarTransactionLink({ txHash, network = "testnet" }: StellarTransactionLinkProps) {
  const url = `https://stellar.expert/explorer/${network}/tx/${txHash}`;
  const truncated = `${txHash.slice(0, 8)}â€¦${txHash.slice(-8)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-sm text-blue-600 underline hover:text-blue-800"
    >
      {truncated}
    </a>
  );
}

const STATUS_CONFIG = {
  CONFIRMED: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    label: "Confirmed",
  },
  PENDING: {
    icon: Clock,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    label: "Pending",
  },
  FAILED: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Failed",
  },
} as const;

interface VerificationStatusCardProps {
  verificationRecord?: VerificationRecord | null;
}

export default function VerificationStatusCard({
  verificationRecord,
}: VerificationStatusCardProps) {
  if (!verificationRecord) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-5">
        <HelpCircle className="h-5 w-5 text-gray-400" aria-hidden="true" />
        <p className="text-sm text-gray-500">Not yet verified</p>
      </div>
    );
  }

  if (verificationRecord.status === "PENDING") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-5">
        <Clock className="h-5 w-5 text-yellow-600" aria-hidden="true" />
        <p className="text-sm font-medium text-yellow-700">Verification pending</p>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[verificationRecord.status];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5 space-y-3`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${cfg.color}`} aria-hidden="true" />
        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">Transaction</dt>
          <dd>
            <StellarTransactionLink txHash={verificationRecord.stellarTxHash} />
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Ledger</dt>
          <dd className="font-mono text-gray-900">{verificationRecord.stellarLedger}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Anchored at</dt>
          <dd className="text-gray-900">
            {new Date(verificationRecord.anchoredAt).toLocaleString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}
