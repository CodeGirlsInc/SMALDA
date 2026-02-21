import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from '../enums/audit-action.enum';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog {
  @ApiProperty({ description: 'Unique identifier (UUID)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    enum: AuditAction,
    description: 'The action that was performed',
    example: AuditAction.DOCUMENT_UPLOADED,
  })
  @Column({ type: 'varchar' })
  action: string;

  @ApiProperty({
    description: 'The type of entity this log entry relates to',
    example: 'UploadedDocument',
  })
  @Column({ type: 'varchar' })
  entityType: string;

  @ApiProperty({
    description: 'The ID of the affected entity',
    example: 'b3d2c1a0-...',
  })
  @Column({ type: 'varchar' })
  entityId: string;

  @ApiPropertyOptional({
    description: 'Identifier of the actor that triggered the action (user ID or system label)',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true, default: null })
  actorId: string | null;

  @ApiPropertyOptional({
    description: 'Snapshot of the entity state before the action',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true, default: null })
  before: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'Snapshot of the entity state after the action',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true, default: null })
  after: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'IP address of the client that initiated the request',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true, default: null })
  ipAddress: string | null;

  @ApiPropertyOptional({
    description: 'User-Agent header of the client that initiated the request',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true, default: null })
  userAgent: string | null;

  @ApiProperty({ description: 'Timestamp when this log entry was created' })
  @CreateDateColumn()
  createdAt: Date;
}
