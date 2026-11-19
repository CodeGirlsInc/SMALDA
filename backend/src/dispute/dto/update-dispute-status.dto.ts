import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DisputeResolution, DisputeStatus } from '../entities/dispute.entity';

export class UpdateDisputeStatusDto {
  @IsEnum(DisputeStatus)
  status: DisputeStatus;

  @IsOptional()
  @IsEnum(DisputeResolution)
  resolution?: DisputeResolution;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
