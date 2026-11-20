/**
 * Live document updates over the backend's Socket.IO `/documents` namespace
 * (#1642, #1643).
 *
 * Auth is the httpOnly cookie (`withCredentials`). After connecting the hook
 * emits `subscribe:document` for the document, then forwards the server's
 * `document:status-changed` and `verification:status-changed` events. The
 * connection is closed on unmount or when the document id changes.
 */
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getApiOrigin } from "@/lib/api-config";

export interface DocumentStatusEvent {
  documentId: string;
  status: string;
  previousStatus?: string | null;
  timestamp?: string;
}

export interface DocumentStatusHandlers {
  onStatus?: (event: DocumentStatusEvent) => void;
  onVerification?: (event: DocumentStatusEvent) => void;
}

export function useDocumentStatusSocket(
  documentId: string | null | undefined,
  handlers: DocumentStatusHandlers,
  baseUrl: string | null = getApiOrigin(),
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!documentId || !baseUrl) return;

    const socket: Socket = io(`${baseUrl}/documents`, {
      transports: ["websocket"],
      withCredentials: true,
    });
    socket.on("connect", () => {
      socket.emit("subscribe:document", { documentId });
    });
    socket.on("document:status-changed", (event: DocumentStatusEvent) =>
      handlersRef.current.onStatus?.(event),
    );
    socket.on("verification:status-changed", (event: DocumentStatusEvent) =>
      handlersRef.current.onVerification?.(event),
    );

    return () => {
      socket.emit("unsubscribe:document", { documentId });
      socket.off();
      socket.disconnect();
    };
  }, [documentId, baseUrl]);
}
