import { IsString, IsOptional, IsEnum, IsObject, IsDateString, IsArray, IsBoolean } from "class-validator"
import { ExportFormat } from "../entities/training-export.entity"
import { DatasetStatus, RiskLevel } from "../entities/dataset-record.entity"

export class ExportTrainingDataDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat

  @IsOptional()
  @IsArray()
  @IsEnum(DatasetStatus, { each: true })
  statusFilter?: DatasetStatus[]

  @IsOptional()
  @IsArray()
  @IsEnum(RiskLevel, { each: true })
  riskLevelFilter?: RiskLevel[]

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsBoolean()
  includeTrainingData?: boolean

  @IsOptional()
  @IsBoolean()
  includeValidationData?: boolean

  @IsOptional()
  @IsBoolean()
  includeTestData?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagFilter?: string[]

  @IsOptional()
  @IsObject()
  additionalFilters?: Record<string, any>
}
