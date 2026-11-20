import { IsEnum, IsOptional } from 'class-validator';
import { DisputeStatus } from '../entities/dispute.entity';
import { PaginateDisputesDto } from './paginate-disputes.dto';

/**
 * Query params for the admin dispute listing: pagination plus an optional
 * status filter.
 */
export class ListDisputesDto extends PaginateDisputesDto {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;
}
