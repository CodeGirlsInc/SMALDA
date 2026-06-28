import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth-store';

class WebSocketService {
  private socket: Socket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(url?: string) {
    this.url = url || process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:6004';
  }

  connect() {
    if (this.socket?.connected) return;

    const token = useAuthStore.getState().token;
    this.socket = io(this.url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.socket?.disconnect();
      }
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  on(event: string, callback: (...args: unknown[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: unknown[]) => void) {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  emit(event: string, data?: unknown) {
    this.socket?.emit(event, data);
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const wsService = new WebSocketService();
export const connectWebSocket = () => wsService.connect();
export const disconnectWebSocket = () => wsService.disconnect();
export const subscribeToEvent = (event: string, callback: (...args: unknown[]) => void) =>
  wsService.on(event, callback);
export const unsubscribeFromEvent = (event: string, callback?: (...args: unknown[]) => void) =>
  wsService.off(event, callback);
export const emitEvent = (event: string, data?: unknown) => wsService.emit(event, data);
