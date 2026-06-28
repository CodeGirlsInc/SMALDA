import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VERIFY = 'VERIFY',
  EXPORT = 'EXPORT',
  SHARE = 'SHARE',
  REVOKE = 'REVOKE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

@Entity('audit_logs')
@Index('IDX_AUDIT_USER_ID', ['userId'])
@Index('IDX_AUDIT_ENTITY', ['entity'])
@Index('IDX_AUDIT_ACTION', ['action'])
@Index('IDX_AUDIT_CREATED_AT', ['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column()
  entity: string;

  @Column({ name: 'entity_id' })
  entityId: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
