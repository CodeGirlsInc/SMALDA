import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  /**
   * Notify a specific user about a document status change.
   */
  notifyDocumentStatusChange(
    userId: string,
    documentId: string,
    status: string,
  ) {
    this.logger.log(
      `Emitting document status change to user ${userId}: document ${documentId} → ${status}`,
    );
    this.gateway.emitToUser(userId, 'document:status_changed', {
      documentId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify a specific user that verification has completed.
   */
  notifyVerificationComplete(
    userId: string,
    documentId: string,
    txHash?: string,
  ) {
    this.logger.log(
      `Emitting verification complete to user ${userId}: document ${documentId}`,
    );
    this.gateway.emitToUser(userId, 'document:verification_complete', {
      documentId,
      stellarTxHash: txHash,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send a generic notification to a specific user.
   */
  notifyUser(userId: string, event: string, payload: unknown) {
    this.gateway.emitToUser(userId, event, payload);
  }

  /**
   * Broadcast an event to all connected users.
   */
  broadcast(event: string, payload: unknown) {
    this.gateway.emitToAll(event, payload);
  }
}
