import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from '../enums/audit-action.enum';

export class CreateAuditLogDto {
  @ApiProperty({
    enum: AuditAction,
    description: 'The action that was performed',
    example: AuditAction.DOCUMENT_UPLOADED,
  })
  @IsEnum(AuditAction)
  action: AuditAction;

  @ApiProperty({
    description: 'The type of entity this log entry relates to',
    example: 'UploadedDocument',
  })
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @ApiProperty({
    description: 'The ID of the affected entity',
    example: 'b3d2c1a0-...',
  })
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiPropertyOptional({
    description: 'Identifier of the actor that triggered the action',
    example: 'user-uuid or "system"',
  })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Entity state before the action (JSON snapshot)',
  })
  @IsOptional()
  @IsObject()
  before?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Entity state after the action (JSON snapshot)',
  })
  @IsOptional()
  @IsObject()
  after?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'IP address of the originating request' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User-Agent of the originating request' })
  @IsOptional()
  @IsString()
  userAgent?: string;
}
