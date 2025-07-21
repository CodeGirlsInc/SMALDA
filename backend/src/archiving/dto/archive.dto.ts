import { IsEnum, IsOptional, IsString, IsNumber, IsBoolean, IsUUID, IsDateString, Min, Max } from "class-validator"
import { ArchiveReason, ArchiveStatus } from "../entities/archived-document.entity"
import { PolicyStatus, PolicyTrigger } from "../entities/archive-policy.entity"

export class CreateArchivePolicyDto {
  @IsString()
  name: string

  @IsString()
  description: string

  @IsOptional()
  @IsString()
  documentType?: string

  @IsEnum(PolicyTrigger)
  trigger: PolicyTrigger

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650) // Max 10 years
  inactivityPeriodDays?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(7300) // Max 20 years
  retentionPeriodDays?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStorageSize?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDocumentCount?: number

  @IsOptional()
  @IsBoolean()
  compressOnArchive?: boolean

  @IsOptional()
  @IsBoolean()
  moveToExternalStorage?: boolean

  @IsOptional()
  @IsString()
  externalStorageConfig?: string

  @IsOptional()
  conditions?: Record<string, any>

  @IsOptional()
  archiveActions?: Record<string, any>

  @IsOptional()
  @IsString()
  createdBy?: string
}

export class UpdateArchivePolicyDto {
  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650)
  inactivityPeriodDays?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(7300)
  retentionPeriodDays?: number

  @IsOptional()
  @IsBoolean()
  compressOnArchive?: boolean

  @IsOptional()
  @IsBoolean()
  moveToExternalStorage?: boolean

  @IsOptional()
  conditions?: Record<string, any>

  @IsOptional()
  archiveActions?: Record<string, any>
}

export class ManualArchiveDto {
  @IsUUID("4", { each: true })
  documentIds: string[]

  @IsEnum(ArchiveReason)
  reason: ArchiveReason

  @IsOptional()
  @IsString()
  archivedBy?: string

  @IsOptional()
  metadata?: Record<string, any>
}

export class RestoreDocumentDto {
  @IsUUID("4", { each: true })
  archivedDocumentIds: string[]

  @IsOptional()
  @IsString()
  restoredBy?: string

  @IsOptional()
  @IsString()
  reason?: string
}

export class QueryArchivedDocumentsDto {
  @IsOptional()
  @IsString()
  documentType?: string

  @IsOptional()
  @IsString()
  shipmentId?: string

  @IsOptional()
  @IsString()
  uploadedBy?: string

  @IsOptional()
  @IsEnum(ArchiveReason)
  archiveReason?: ArchiveReason

  @IsOptional()
  @IsEnum(ArchiveStatus)
  status?: ArchiveStatus

  @IsOptional()
  @IsDateString()
  archivedAfter?: string

  @IsOptional()
  @IsDateString()
  archivedBefore?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0
}

export class ScheduleArchiveJobDto {
  @IsEnum(PolicyTrigger)
  jobType: PolicyTrigger

  @IsOptional()
  @IsUUID()
  policyId?: string

  @IsOptional()
  jobParameters?: Record<string, any>

  @IsOptional()
  @IsDateString()
  scheduledAt?: string

  @IsOptional()
  @IsString()
  triggeredBy?: string
}
