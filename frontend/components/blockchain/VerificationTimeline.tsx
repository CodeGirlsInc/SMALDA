// frontend/components/blockchain/VerificationTimeline.tsx
import { VerificationEvent } from "@/types/blockchain";

export function VerificationTimeline({
  events,
}: {
  events: VerificationEvent[];
}) {
  return (
    <ol className="relative border-l pl-4 space-y-6">
      {events.map((event) => (
        <li key={event.id}>
          <time className="text-xs text-gray-500">
            {new Date(event.timestamp).toLocaleString()}
          </time>
          <p className="font-medium capitalize">{event.status}</p>

          {event.txHash && (
            <a
              href={`https://stellar.expert/explorer/public/tx/${event.txHash}`}
              target="_blank"
              className="text-sm text-blue-600 hover:underline"
            >
              View on Stellar Explorer
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
