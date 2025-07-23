import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsObject } from "class-validator"
import { AuditAction, AuditSeverity } from "../entities/audit-log.entity"

export class CreateAuditLogDto {
  @IsString()
  @IsNotEmpty()
  userId: string

  @IsString()
  @IsNotEmpty()
  userEmail: string

  @IsEnum(AuditAction)
  action: AuditAction

  @IsOptional()
  @IsEnum(AuditSeverity)
  severity?: AuditSeverity = AuditSeverity.LOW

  @IsString()
  @IsNotEmpty()
  description: string

  @IsOptional()
  @IsString()
  resourceType?: string

  @IsOptional()
  @IsString()
  resourceId?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>

  @IsOptional()
  @IsString()
  ipAddress?: string

  @IsOptional()
  @IsString()
  userAgent?: string

  @IsOptional()
  @IsBoolean()
  success?: boolean = true

  @IsOptional()
  @IsString()
  errorMessage?: string
}
