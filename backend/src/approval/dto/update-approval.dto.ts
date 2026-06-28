import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalStatus } from '../approval.entity';

export class UpdateApprovalDto {
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}
