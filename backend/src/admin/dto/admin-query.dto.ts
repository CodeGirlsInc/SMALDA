import { IsOptional, IsEnum, IsString, IsDateString, IsNumber, Min, Max, IsBoolean } from "class-validator"
import { Transform } from "class-transformer"
import { UserRole, UserStatus } from "../entities/user.entity"
import { RiskLevel } from "../../risk-analysis/entities/risk-analysis.entity"

export class UserQueryDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus

  @IsOptional()
  @IsString()
  department?: string

  @IsOptional()
  @IsString()
  search?: string

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
}

export class RiskReportQueryDto {
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel

  @IsOptional()
  @IsString()
  analyzedBy?: string

  @IsOptional()
  @IsString()
  analysisMethod?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  flaggedOnly?: boolean

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
}

export class DocumentStatsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsString()
  uploadedBy?: string

  @IsOptional()
  @IsString()
  mimeType?: string
}
