{
  ;`import { IsOptional, IsEnum, IsString, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { RiskStatus } from '../enums/risk-status.enum';
import { ApiProperty } from '@nestjs/swagger';

export class FilterDocumentVersionsDto {
  @ApiProperty({ description: 'Filter by specific version number', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  versionNumber?: number;

  @ApiProperty({ description: 'Filter by user ID who uploaded the version', required: false, format: 'uuid' })
  @IsOptional()
  @IsString()
  uploadedBy?: string;

  @ApiProperty({ enum: RiskStatus, description: 'Filter by risk status of the version', required: false })
  @IsOptional()
  @IsEnum(RiskStatus)
  riskStatus?: RiskStatus;

  @ApiProperty({ description: 'Filter by version creation date (start date)', required: false, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Filter by version creation date (end date)', required: false, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Page number for pagination', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({ description: 'Number of items per page', required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ description: 'Field to sort by (e.g., createdAt, versionNumber)', required: false, default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ enum: ['ASC', 'DESC'], description: 'Sort order (ASC or DESC)', required: false, default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}`
}
