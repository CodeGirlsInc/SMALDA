import { IsString, IsEnum, IsOptional, IsDateString, IsDecimal, IsNotEmpty } from 'class-validator';
import { CaseType, CaseStatus, CaseOutcome } from '../entities/court-case.entity';

export class CreateCourtCaseDto {
  @IsString()
  @IsNotEmpty()
  caseNumber: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CaseType)
  caseType: CaseType;

  @IsEnum(CaseStatus)
  @IsOptional()
  status?: CaseStatus;

  @IsEnum(CaseOutcome)
  @IsOptional()
  outcome?: CaseOutcome;

  @IsString()
  @IsNotEmpty()
  region: string;

  @IsString()
  @IsNotEmpty()
  court: string;

  @IsString()
  @IsNotEmpty()
  plaintiff: string;

  @IsString()
  @IsNotEmpty()
  defendant: string;

  @IsString()
  @IsOptional()
  judge?: string;

  @IsDecimal()
  @IsOptional()
  claimAmount?: number;

  @IsDecimal()
  @IsOptional()
  settlementAmount?: number;

  @IsDateString()
  filedDate: Date;

  @IsDateString()
  @IsOptional()
  resolvedDate?: Date;
}
