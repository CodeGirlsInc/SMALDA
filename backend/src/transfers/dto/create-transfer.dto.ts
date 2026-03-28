import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTransferDto {
  @IsUUID()
  documentId: string;

  @IsUUID()
  fromUserId: string;

  @IsUUID()
  toUserId: string;

  @IsOptional()
  @IsISO8601()
  transferredAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
