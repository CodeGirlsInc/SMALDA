// [BE-51] Add in-app notification entity and endpoints
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

export enum NotificationType {
  DOCUMENT_VERIFIED = 'document_verified',
  DOCUMENT_FLAGGED = 'document_flagged',
  DOCUMENT_REJECTED = 'document_rejected',
  PROCESSING_COMPLETE = 'processing_complete',
  SYSTEM = 'system',
}

@Entity('notifications')
@Index('IDX_NOTIFICATION_USER_ID', ['userId'])
@Index('IDX_NOTIFICATION_IS_READ', ['isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'document_id', nullable: true })
  documentId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
