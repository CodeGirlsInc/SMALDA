import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Payload for reassigning a dispute to a different reviewer, needed when
 * the currently assigned reviewer is unavailable or has a conflict.
 */
export class ReassignDisputeDto {
  @IsString()
  @IsNotEmpty()
  newReviewerId: string;

  @IsString()
  reason?: string;
}
