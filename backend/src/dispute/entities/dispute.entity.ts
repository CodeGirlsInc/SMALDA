import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Document } from '../../documents/entities/document.entity';

export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum ResolutionAction {
  NONE = 'none',
  DOCUMENT_UPDATED = 'document_updated',
  OWNERSHIP_TRANSFERRED = 'ownership_transferred',
  COMPENSATION_ISSUED = 'compensation_issued',
}

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'raised_by_id' })
  raisedById: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  raisedBy: User;

  @Column({ name: 'document_id' })
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  document: Document;

  @Column()
  reason: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({
    type: 'enum',
    enum: ResolutionAction,
    default: ResolutionAction.NONE,
  })
  resolutionAction: ResolutionAction;

  @Column({ type: 'text', nullable: true })
  resolutionNote?: string;

  @Column({ name: 'resolved_by_id', nullable: true })
  resolvedById?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
