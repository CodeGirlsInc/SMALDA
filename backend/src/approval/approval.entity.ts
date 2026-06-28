import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/entities/user.entity';
import { VerificationRecord } from '../verification/entities/verification-record.entity';

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('approvals')
@Index('IDX_APPROVAL_VERIFICATION', ['verificationId'])
@Index('IDX_APPROVAL_APPROVER', ['approverId'])
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'verification_id' })
  verificationId: string;

  @ManyToOne(() => VerificationRecord, { onDelete: 'CASCADE' })
  verification: VerificationRecord;

  @Column({ name: 'approver_id' })
  approverId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  approver: User;

  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ name: 'required_count', default: 2 })
  requiredCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
