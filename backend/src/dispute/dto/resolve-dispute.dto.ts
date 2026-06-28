import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DisputeStatus, ResolutionAction } from '../entities/dispute.entity';

export class ResolveDisputeDto {
  @IsEnum(DisputeStatus)
  status: DisputeStatus.RESOLVED | DisputeStatus.DISMISSED;

  @IsEnum(ResolutionAction)
  action: ResolutionAction;

  @IsOptional()
  @IsString()
  note?: string;
}
