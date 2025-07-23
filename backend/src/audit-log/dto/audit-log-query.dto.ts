import { IsOptional, IsEnum, IsString, IsDateString, IsNumber, Min, Max } from "class-validator"
import { Transform } from "class-transformer"
import { AuditAction, AuditSeverity } from "../entities/audit-log.entity"

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction

  @IsOptional()
  @IsEnum(AuditSeverity)
  severity?: AuditSeverity

  @IsOptional()
  @IsString()
  resourceType?: string

  @IsOptional()
  @IsString()
  resourceId?: string

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
