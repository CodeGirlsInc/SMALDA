// frontend/components/blockchain/TransactionModal.tsx
"use client";

export function TransactionModal({
  open,
  txHash,
  onClose,
}: {
  open: boolean;
  txHash: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h3 className="font-semibold mb-2">Transaction</h3>
        <p className="text-xs break-all mb-4">{txHash}</p>

        <a
          href={`https://stellar.expert/explorer/public/tx/${txHash}`}
          target="_blank"
          className="text-blue-600 text-sm"
        >
          Open in Explorer
        </a>

        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-900 text-white py-2 rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}
