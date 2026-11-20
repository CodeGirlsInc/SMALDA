import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationType {
  RISK_ALERT = 'risk_alert',
  VERIFICATION_COMPLETE = 'verification_complete',
  DISPUTE_UPDATE = 'dispute_update',
}

@Entity('notifications')
@Index('IDX_NOTIFICATION_USER', ['userId'])
@Index('IDX_NOTIFICATION_USER_UNREAD', ['userId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'document_id', nullable: true })
  documentId?: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
