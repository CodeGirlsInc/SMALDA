import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { NotificationType } from '../enums/notification-type.enum';

@Entity('notification_logs')
@Index(['recipient'])
@Index(['documentId'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  recipient: string;

  @Column({ type: 'varchar' })
  subject: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'uuid' })
  documentId: string;

  @CreateDateColumn()
  sentAt: Date;

  @Column({ type: 'boolean', default: false })
  success: boolean;

  @Column({ type: 'text', nullable: true, default: null })
  errorMessage: string | null;
}
