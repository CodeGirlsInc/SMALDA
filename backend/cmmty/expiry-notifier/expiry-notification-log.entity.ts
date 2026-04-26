import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cmmty_expiry_notification_logs')
export class ExpiryNotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column()
  userId: string;

  @CreateDateColumn()
  sentAt: Date;
}
