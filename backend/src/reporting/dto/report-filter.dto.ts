import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType, ReportStatus, ReportFormat } from '../entities/report.entity';

export class ReportFilterDto {
  @ApiPropertyOptional({ enum: ReportType, description: 'Filter by report type' })
  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType;

  @ApiPropertyOptional({ enum: ReportStatus, description: 'Filter by report status' })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @ApiPropertyOptional({ enum: ReportFormat, description: 'Filter by report format' })
  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat;

  @ApiPropertyOptional({ description: 'Filter by start date (created after)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (created before)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort order', default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
