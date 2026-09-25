"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ApiError, ensureValidSession } from "@/lib/api-client";
import { initCrossTabLogoutSync } from "@/lib/session-expiry-warning";

interface SessionBootstrapProps {
  children: ReactNode;
}

const MAX_BOOTSTRAP_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;

export function SessionBootstrap({ children }: SessionBootstrapProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const stopLogoutSync = initCrossTabLogoutSync();

    const establishSession = async () => {
      for (let attempt = 1; attempt <= MAX_BOOTSTRAP_ATTEMPTS; attempt += 1) {
        try {
          const accessToken = await ensureValidSession();
          if (!active) return;
          if (accessToken) {
            setReady(true);
            return;
          }

          const params = new URLSearchParams();
          params.set(
            "redirect",
            window.location.pathname + window.location.search,
          );
          window.location.href = `/login?${params.toString()}`;
          return;
        } catch (error: unknown) {
          if (!active) return;
          if (error instanceof ApiError && error.kind === "authRequired") return;
          if (attempt === MAX_BOOTSTRAP_ATTEMPTS) {
            setFailed(true);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          if (!active) return;
        }
      }
    };

    void establishSession();

    return () => {
      active = false;
      stopLogoutSync();
    };
  }, []);

  if (ready) return children;
  if (failed) {
    return (
      <main role="alert">
        <p>Session verification failed.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Retry
        </button>
      </main>
    );
  }
  return null;
}
