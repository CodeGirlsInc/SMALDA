import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PROFILE_UPDATE = 'profile_update',
  DOCUMENT_UPLOAD = 'document_upload',
  DOCUMENT_DELETE = 'document_delete',
  DOCUMENT_SEARCH = 'document_search',
  RISK_ASSESSMENT = 'risk_assessment',
  VERIFICATION_REQUEST = 'verification_request',
  ADMIN_ACCESS = 'admin_access',
}

export enum ResourceType {
  USER = 'user',
  DOCUMENT = 'document',
  SYSTEM = 'system',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: ResourceType,
  })
  resourceType: ResourceType;

  @Column({ name: 'resource_id', nullable: true })
  resourceId?: string;

  @Column({ name: 'ip_address' })
  ipAddress: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}