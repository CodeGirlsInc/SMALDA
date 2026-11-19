import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Payload for reassigning a dispute to a different reviewer, needed when
 * the currently assigned reviewer is unavailable or has a conflict.
 */
export class ReassignDisputeDto {
  @IsUUID()
  @IsString()
  @IsNotEmpty()
  newReviewerId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
