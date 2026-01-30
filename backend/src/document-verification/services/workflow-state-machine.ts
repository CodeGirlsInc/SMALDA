import { BadRequestException } from '@nestjs/common';
import { DocumentStatus } from '../enums/document-status.enum';

export class WorkflowStateMachine {
  // Define valid state transitions
  private readonly transitions: Map<DocumentStatus, DocumentStatus[]> = new Map([
    [DocumentStatus.SUBMITTED, [DocumentStatus.PENDING_REVIEW]],
    [
      DocumentStatus.PENDING_REVIEW,
      [DocumentStatus.APPROVED, DocumentStatus.REJECTED],
    ],
    [DocumentStatus.APPROVED, []],
    [DocumentStatus.REJECTED, []],
  ]);

  /**
   * Check if a transition from currentStatus to newStatus is allowed
   */
  isTransitionAllowed(
    currentStatus: DocumentStatus,
    newStatus: DocumentStatus,
  ): boolean {
    const allowedTransitions = this.transitions.get(currentStatus);
    return allowedTransitions ? allowedTransitions.includes(newStatus) : false;
  }

  /**
   * Get all allowed transitions from a given status
   */
  getAllowedTransitions(status: DocumentStatus): DocumentStatus[] {
    return this.transitions.get(status) || [];
  }

  /**
   * Validate transition and throw error if not allowed
   */
  validateTransition(
    currentStatus: DocumentStatus,
    newStatus: DocumentStatus,
  ): void {
    if (!this.isTransitionAllowed(currentStatus, newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
