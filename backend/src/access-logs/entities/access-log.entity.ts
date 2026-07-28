import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AccessAction {
  READ = 'read',
  DOWNLOAD = 'download',
  EXPORT = 'export',
  ADMIN_READ = 'admin_read',
  DENIED = 'denied',
}

@Entity('access_logs')
@Index('IDX_ACCESS_LOG_DOCUMENT', ['documentId'])
@Index('IDX_ACCESS_LOG_USER', ['userId'])
export class AccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  documentId: string;

  @Column()
  routePath: string;

  @Column()
  httpMethod: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ type: 'enum', enum: AccessAction, default: AccessAction.READ })
  action: AccessAction;

  @Column({ type: 'boolean', default: false })
  isAdmin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'int', nullable: true })
  statusCode: number;
}
