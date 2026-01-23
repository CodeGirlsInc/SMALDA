import { VerificationStatus } from "@/types/blockchain";

const styles: Record<VerificationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  verified: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}
    >
      {status.toUpperCase()}
    </span>
  );
}
