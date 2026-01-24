// frontend/hooks/useVerificationStatus.ts
import { useEffect, useState } from "react";
import { VerificationEvent } from "@/types/blockchain";

export function useVerificationStatus(documentId: string) {
  const [events, setEvents] = useState<VerificationEvent[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/verification/${documentId}`);
        const data = await res.json();
        setEvents(data.events);
      } catch {
        setError(true);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);

    return () => clearInterval(interval);
  }, [documentId]);

  return { events, error };
}
