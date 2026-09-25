import { IsEnum } from 'class-validator';
import { DisputeStatus } from '../entities/dispute.entity';

export class UpdateDisputeStatusDto {
  @IsEnum(DisputeStatus)
  status: DisputeStatus;
}
