"use client";

export function CopyHashButton({ hash }: { hash: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(hash);
  };

  return (
    <button
      onClick={copy}
      className="text-xs text-gray-600 hover:text-black"
    >
      Copy transaction hash
    </button>
  );
}
