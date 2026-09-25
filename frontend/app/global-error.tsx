"use client";

import { useEffect, type CSSProperties } from "react";
import {
  CLIENT_ERROR_ENDPOINT,
  createOpaqueEventId,
  getSafeErrorDigest,
} from "@/lib/client-error-report";

const pageStyle: CSSProperties = {
  margin: 0,
  minHeight: "100vh",
  backgroundColor: "#ffffff",
  color: "#171717",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const mainStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  minHeight: "100vh",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  padding: "2rem 1rem",
  textAlign: "center",
};

const actionStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "2.75rem",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "0.5rem",
  padding: "0.625rem 1rem",
  border: "1px solid #2563eb",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "0.875rem",
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    const report = {
      boundary: "global-error" as const,
      digest: getSafeErrorDigest(error.digest),
      eventId: createOpaqueEventId(),
    };

    const reportError = async () => {
      try {
        const response = await fetch(CLIENT_ERROR_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
          cache: "no-store",
          credentials: "omit",
          keepalive: true,
          referrerPolicy: "no-referrer",
        });

        if (!response.ok) {
          return;
        }
      } catch {
        return;
      }
    };

    void reportError();
  }, [error]);

  const handleRetry = () => {
    if (!reset) {
      window.location.reload();
      return;
    }

    try {
      reset();
    } catch {
      window.location.reload();
    }
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Application error</title>
      </head>
      <body style={pageStyle}>
        <main style={mainStyle}>
          <h1 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.2 }}>
            Something went wrong
          </h1>
          <p style={{ margin: 0, color: "#525252", lineHeight: 1.5 }}>
            An unexpected error occurred. Please try again.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.75rem",
            }}
          >
            <button type="button" onClick={handleRetry} style={actionStyle}>
              Try again
            </button>
            <a
              href="/"
              style={{
                ...actionStyle,
                borderColor: "#737373",
                backgroundColor: "#ffffff",
                color: "#171717",
              }}
            >
              Go back home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
