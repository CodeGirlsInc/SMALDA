import { IsOptional, IsEnum, IsString, IsDateString, IsNumber, Min, Max } from "class-validator"
import { Transform } from "class-transformer"
import { ReportType, ReportFormat, ReportStatus } from "../entities/report.entity"

export class ReportQueryDto {
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus

  @IsOptional()
  @IsString()
  generatedBy?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value))
  @IsNumber()
  @Min(0)
  offset?: number = 0

  @IsOptional()
  @IsString()
  search?: string
}
