import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../src/users/entities/user.entity';

@Entity('notification_preferences')
export class NotificationPrefs {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'risk_alert', default: true })
  riskAlert: boolean;

  @Column({ name: 'verification_complete', default: true })
  verificationComplete: boolean;

  @Column({ name: 'weekly_digest', default: true })
  weeklyDigest: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column(() => User, { primary: true })
  user: User;
}
