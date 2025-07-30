import { IsOptional, IsString, IsDateString, IsEnum, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { CaseType, CaseOutcome, CaseStatus } from '../entities/court-case.entity';

export class AnalysisQueryDto {
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => typeof value === 'string' ? [value] : value)
  regions?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(CaseType, { each: true })
  @Transform(({ value }) => typeof value === 'string' ? [value] : value)
  caseTypes?: CaseType[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  court?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(CaseStatus, { each: true })
  @Transform(({ value }) => typeof value === 'string' ? [value] : value)
  statuses?: CaseStatus[];
}