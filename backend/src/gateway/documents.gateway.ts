import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/documents',
})
export class DocumentsGateway {
  @WebSocketServer()
  server: Server;

  notifyDocumentStatusChange(documentId: string, status: string) {
    this.server.emit('document:status-changed', { documentId, status });
  }

  notifyVerificationUpdate(documentId: string, status: string, txHash?: string) {
    this.server.emit('document:verification-updated', { documentId, status, txHash });
  }
}
