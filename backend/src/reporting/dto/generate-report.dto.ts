import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsObject, IsEmail, IsArray } from "class-validator"
import { ReportType, ReportFormat } from "../entities/report.entity"

export class GenerateReportDto {
  @IsEnum(ReportType)
  type: ReportType

  @IsEnum(ReportFormat)
  format: ReportFormat

  @IsString()
  @IsNotEmpty()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsString()
  @IsNotEmpty()
  generatedBy: string

  @IsEmail()
  generatedByEmail: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[]

  @IsOptional()
  @IsString()
  riskLevel?: string

  @IsOptional()
  @IsString()
  department?: string

  @IsOptional()
  @IsObject()
  additionalFilters?: Record<string, any>

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
