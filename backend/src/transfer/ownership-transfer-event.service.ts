import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export class OwnershipTransferredEvent {
  constructor(
    public readonly documentId: string,
    public readonly fromOwner: string,
    public readonly toOwner: string,
    public readonly transferredAt: Date,
  ) {}
}

/**
 * Emits a typed event whenever an ownership transfer succeeds,
 * allowing downstream consumers to react without polling.
 * Closes #1341
 */
@Injectable()
export class OwnershipTransferEventService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emitTransferred(documentId: string, fromOwner: string, toOwner: string): void {
    const event = new OwnershipTransferredEvent(
      documentId,
      fromOwner,
      toOwner,
      new Date(),
    );
    this.eventEmitter.emit('ownership.transferred', event);
  }
}
