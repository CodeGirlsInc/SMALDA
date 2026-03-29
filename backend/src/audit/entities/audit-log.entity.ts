import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditAction {
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  DOCUMENT_DELETE = 'DOCUMENT_DELETE',
  VERIFICATION_TRIGGER = 'VERIFICATION_TRIGGER',
  ROLE_CHANGE = 'ROLE_CHANGE',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column()
  resourceType: string;

  @Column()
  resourceId: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
