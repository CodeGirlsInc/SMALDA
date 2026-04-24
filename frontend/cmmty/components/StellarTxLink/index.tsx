"use client";

import React, { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

interface StellarTxLinkProps {
  hash?: string | null;
}

export function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

export default function StellarTxLink({ hash }: StellarTxLinkProps) {
  const [copied, setCopied] = useState(false);

  if (!hash) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${hash}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm">
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline dark:text-blue-400 inline-flex items-center gap-1"
        aria-label={`View transaction ${hash} on Stellar explorer`}
      >
        {truncateHash(hash)}
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
      <button
        onClick={handleCopy}
        aria-label="Copy transaction hash"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
