// [BE-50] Add WebSocket gateway for real-time document processing updates
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';

export interface ProcessingUpdate {
  documentId: string;
  status: string;
  progress?: number;
  message?: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/processing' })
export class ProcessingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() documentId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`document:${documentId}`);
    return { event: 'subscribed', documentId };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() documentId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`document:${documentId}`);
    return { event: 'unsubscribed', documentId };
  }

  emitProcessingUpdate(update: ProcessingUpdate) {
    this.server
      .to(`document:${update.documentId}`)
      .emit('processing:update', update);
  }

  emitProcessingComplete(documentId: string, status: string) {
    this.server
      .to(`document:${documentId}`)
      .emit('processing:complete', { documentId, status });
  }
}
