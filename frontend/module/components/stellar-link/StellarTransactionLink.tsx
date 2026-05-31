"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface StellarTransactionLinkProps {
  txHash?: string | null;
  network?: "testnet" | "mainnet";
}

export default function StellarTransactionLink({
  txHash,
  network = "testnet",
}: StellarTransactionLinkProps) {
  const [copied, setCopied] = useState(false);

  if (!txHash) return null;

  const url = `https://stellar.expert/explorer/${network}/tx/${txHash}`;
  const truncated = `${txHash.slice(0, 8)}â€¦${txHash.slice(-8)}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm text-blue-600 underline hover:text-blue-800"
      >
        {truncated}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy transaction hash"}
        className="rounded p-0.5 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
      {copied && <span className="text-xs text-green-600">Copied</span>}
    </span>
  );
}
