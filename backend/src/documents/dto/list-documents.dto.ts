import { IsOptional, IsInt, Min, IsEnum, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentStatus } from '../entities/document.entity';

export class ListDocumentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}
