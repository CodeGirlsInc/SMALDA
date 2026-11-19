import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('access_logs')
export class AccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_access_logs_user_id')
  @Column({ nullable: true })
  userId: string;

  @Column()
  routePath: string;

  @Column()
  httpMethod: string;

  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  @Index('idx_access_logs_created_at')
  createdAt: Date;

  @Column({ type: 'int', nullable: true })
  statusCode: number;

  @Column({ name: 'action', nullable: true })
  action?: string | null;

  @Column({ name: 'resource_type', nullable: true })
  resourceType?: string | null;

  @Column({ name: 'resource_id', nullable: true })
  resourceId?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string | null;
}
