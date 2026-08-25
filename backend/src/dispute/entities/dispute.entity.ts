import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DisputeReason } from './dispute-reason.entity';

export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under-review',
  RESOLVED = 'resolved',
}

export const ALLOWED_DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  [DisputeStatus.OPEN]: [DisputeStatus.UNDER_REVIEW],
  [DisputeStatus.UNDER_REVIEW]: [DisputeStatus.RESOLVED],
  [DisputeStatus.RESOLVED]: [],
};

@Entity('disputes')
@Index('IDX_DISPUTE_DOCUMENT', ['documentId'])
@Index('IDX_DISPUTE_FILED_BY', ['filedBy'])
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column({ type: 'text' })
  description: string;

  @ManyToOne(() => DisputeReason, { nullable: true, eager: true })
  reason: DisputeReason | null;

  @Column()
  filedBy: string;

  @Column({
    type: 'varchar',
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}