import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DisputeReason } from './dispute-reason.entity';

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

  @CreateDateColumn()
  createdAt: Date;
}
