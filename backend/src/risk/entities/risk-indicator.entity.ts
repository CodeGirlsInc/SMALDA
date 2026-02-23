import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Document } from '../../documents/entities/document.entity';

export enum RiskSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('risk_indicators')
export class RiskIndicator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  type: string; // e.g. FRAUD, DUPLICATE, OWNERSHIP_CONFLICT

  @Index()
  @Column({
    type: 'enum',
    enum: RiskSeverity,
  })
  severity: RiskSeverity;

  @Index()
  @Column({ default: false })
  resolved: boolean;

  @Index()
  @Column()
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  document: Document;

  @CreateDateColumn()
  createdAt: Date;
}