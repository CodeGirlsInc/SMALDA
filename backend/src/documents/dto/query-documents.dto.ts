import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentStatus } from '../entities/document.entity';

export class QueryDocumentsDto {
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_risk_score?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  max_risk_score?: number;

  @IsOptional()
  @IsISO8601()
  from_date?: string;

  @IsOptional()
  @IsISO8601()
  to_date?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
