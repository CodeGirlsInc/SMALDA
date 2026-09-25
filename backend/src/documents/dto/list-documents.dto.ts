import {
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  Max,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentStatus } from '../entities/document.entity';

export const MAX_DOCUMENT_LIMIT = 100;
export const MAX_DOCUMENT_PAGE = 10000;

export class ListDocumentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_DOCUMENT_LIMIT)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_DOCUMENT_PAGE)
  page?: number = 1;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
