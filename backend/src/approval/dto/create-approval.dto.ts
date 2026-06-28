import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateApprovalDto {
  @IsString()
  verificationId: string;

  @IsString()
  approverId: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  requiredCount?: number;
}
