import { DisputeReason } from '../entities/dispute-reason.entity';
import {
  DisputeResolution,
  DisputeStatus,
} from '../entities/dispute.entity';

export class DisputeResponseDto {
  id: string;
  documentId: string;
  description: string;
  reason: DisputeReason | null;
  filedBy: string;
  status: DisputeStatus;
  reviewerId: string | null;
  resolution: DisputeResolution | null;
  resolutionNote: string | null;
  createdAt: Date;
}