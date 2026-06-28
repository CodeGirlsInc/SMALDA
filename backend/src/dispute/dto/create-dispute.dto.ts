import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDisputeDto {
  @IsUUID()
  documentId: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;
}
