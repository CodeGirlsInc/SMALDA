import { IsString, IsOptional, IsObject } from 'class-validator';
import { AuditAction } from '../audit-log.entity';

export class CreateAuditLogDto {
  @IsString()
  userId: string;

  @IsString()
  action: AuditAction;

  @IsString()
  entity: string;

  @IsString()
  entityId: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
