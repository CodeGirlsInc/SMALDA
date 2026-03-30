import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentStatus } from '../entities/document.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryDocumentsDto extends PaginationDto {
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
}
