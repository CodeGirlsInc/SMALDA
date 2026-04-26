import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from '../../documents/entities/document.entity';

export enum VerificationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('verification_records')
@Index('IDX_VERIFICATION_RECORD_DOCUMENT', ['documentId'])
export class VerificationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  document: Document;

  @Column({ name: 'stellar_tx_hash' })
  stellarTxHash: string;

  @Column({ name: 'stellar_ledger' })
  stellarLedger: number;

  @Column({ name: 'anchored_at', type: 'timestamptz', nullable: true })
  anchoredAt?: Date;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
