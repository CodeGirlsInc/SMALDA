import { DisputeReason } from '../entities/dispute-reason.entity';
import { DisputeStatus } from '../entities/dispute.entity';

export class DisputeResponseDto {
  id: string;
  documentId: string;
  description: string;
  reason: DisputeReason | null;
  filedBy: string;
  status: DisputeStatus;
  createdAt: Date;
}
