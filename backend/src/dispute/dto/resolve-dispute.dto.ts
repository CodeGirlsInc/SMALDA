import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DisputeResolution } from '../entities/dispute.entity';

/**
 * Optional outcome details recorded when an admin resolves a dispute.
 */
export class ResolveDisputeDto {
  @IsOptional()
  @IsEnum(DisputeResolution)
  resolution?: DisputeResolution;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
