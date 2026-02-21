import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LandRecordStatus } from '../../land-record/enums/land-record.enum';
import { RiskLevel } from '../enums/risk-level.enum';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description:
      'Partial case-insensitive match against parcelId, ownerName, and location',
    example: 'Lagos',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    enum: LandRecordStatus,
    description: 'Filter by land record status',
    example: LandRecordStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(LandRecordStatus)
  status?: LandRecordStatus;

  @ApiPropertyOptional({
    enum: RiskLevel,
    description:
      'Filter by computed risk level derived from unresolved risk indicators',
    example: RiskLevel.HIGH,
  })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({
    description: 'Include only records registered on or after this date (ISO 8601)',
    example: '2023-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Include only records registered on or before this date (ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Records per page (max 100)',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
