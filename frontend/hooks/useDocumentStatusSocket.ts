/**
 * Document status socket hook (#1502, #1503).
 *
 * The document page opened a raw WebSocket to `/documents/:id/status`, but the
 * backend serves a Socket.IO namespace, and its manual reconnect loop kept
 * running after the page was closed. This hook connects through Socket.IO and
 * tears the connection down on unmount.
 */
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

export interface DocumentStatusEvent {
  documentId: string;
  status: string;
}

export function useDocumentStatusSocket(
  documentId: string,
  onStatus: (event: DocumentStatusEvent) => void,
  baseUrl: string = process.env.NEXT_PUBLIC_API_URL ?? "",
): void {
  const handlerRef = useRef(onStatus);
  handlerRef.current = onStatus;

  useEffect(() => {
    if (!documentId) {
      return;
    }
    const socket: Socket = io(`${baseUrl}/documents`, {
      transports: ["websocket"],
      withCredentials: true,
    });
    socket.on("status", (event: DocumentStatusEvent) =>
      handlerRef.current(event),
    );
    return () => {
      socket.off("status");
      socket.disconnect();
    };
  }, [documentId, baseUrl]);
}
