import { DisputeReason } from '../entities/dispute-reason.entity';

export class DisputeResponseDto {
  id: string;
  documentId: string;
  description: string;
  reason: DisputeReason | null;
  filedBy: string;
  createdAt: Date;
}
