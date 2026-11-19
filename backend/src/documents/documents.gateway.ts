import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { DocumentsService } from './documents.service';
import { DocumentStatus } from './entities/document.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ACCESS_COOKIE_NAME, getCookieValue } from '../auth/auth-cookie';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';

/*
 * ─────────────────────────────────────────────────────────────────────
 * WebSocket Events — Frontend Consumer Documentation
 * ─────────────────────────────────────────────────────────────────────
 *
 * Client → Server (subscribe to a document's status channel):
 *   Event:  "subscribe:document"
 *   Payload: { documentId: string }
 *
 * Client → Server (unsubscribe):
 *   Event:  "unsubscribe:document"
 *   Payload: { documentId: string }
 *
 * Server → Client (status changed):
 *   Event:  "document:status-changed"
 *   Payload: {
 *     documentId: string,
 *     status: "PENDING" | "ANALYZING" | "VERIFIED" | "FLAGGED" | "REJECTED",
 *     previousStatus: "PENDING" | "ANALYZING" | "VERIFIED" | "FLAGGED" | "REJECTED" | null,
 *     timestamp: string (ISO 8601)
 *   }
 *
 * Server → Client (verification status changed):
 *   Event:  "verification:status-changed"
 *   Payload: {
 *     documentId: string,
 *     status: "PENDING" | "CONFIRMED" | ... (VerificationStatus),
 *     previousStatus: VerificationStatus | null,
 *     timestamp: string (ISO 8601)
 *   }
 * ─────────────────────────────────────────────────────────────────────
 */

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

@WebSocketGateway({ namespace: 'documents' })
@Injectable()
export class DocumentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(DocumentsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly documentsService: DocumentsService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token =
      getCookieValue(client.handshake.headers?.cookie, ACCESS_COOKIE_NAME) ??
      client.handshake.auth?.token;

    if (!token || typeof token !== 'string') {
      client.emit('error', { message: 'Authentication required' });
      client.disconnect();
      return;
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      if (payload.typ !== 'access' || payload.purpose === '2fa') {
        throw new Error('Invalid token type');
      }

      if (await this.authService.isTokenBlacklisted(payload.jti)) {
        throw new Error('Token has been revoked');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new Error('User not found');
      }

      client.userId = user.id;
      client.userRole = user.role;

      client.join(`user:${user.id}`);
    } catch {
      client.emit('error', { message: 'Invalid authentication token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:document')
  async handleSubscribeDocument(
    client: AuthenticatedSocket,
    payload: { documentId: string },
  ): Promise<void> {
    if (!payload?.documentId) {
      throw new WsException('documentId is required');
    }

    const document = await this.documentsService.findById(payload.documentId);
    if (!document) {
      throw new WsException('Document not found');
    }

    if (document.ownerId !== client.userId && client.userRole !== 'admin') {
      throw new WsException('Access denied');
    }

    client.join(`document:${payload.documentId}`);
  }

  @SubscribeMessage('unsubscribe:document')
  async handleUnsubscribeDocument(
    client: AuthenticatedSocket,
    payload: { documentId: string },
  ): Promise<void> {
    if (payload?.documentId) {
      client.leave(`document:${payload.documentId}`);
    }
  }

  notifyStatusChanged(
    documentId: string,
    status: DocumentStatus,
    previousStatus: DocumentStatus | null,
  ): void {
    this.server.to(`document:${documentId}`).emit('document:status-changed', {
      documentId,
      status,
      previousStatus,
      timestamp: new Date().toISOString(),
    });
  }

  notifyVerificationStatusChanged(
    documentId: string,
    status: string,
    previousStatus: string | null,
  ): void {
    this.server
      .to(`document:${documentId}`)
      .emit('verification:status-changed', {
        documentId,
        status,
        previousStatus,
        timestamp: new Date().toISOString(),
      });
  }
}
