import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum CaseStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
  APPEALED = 'appealed',
}

export enum CaseOutcome {
  WON = 'won',
  LOST = 'lost',
  SETTLED = 'settled',
  DISMISSED = 'dismissed',
  PENDING = 'pending',
}

export enum CaseType {
  CIVIL = 'civil',
  CRIMINAL = 'criminal',
  FAMILY = 'family',
  CORPORATE = 'corporate',
  PERSONAL_INJURY = 'personal_injury',
  CONTRACT = 'contract',
}

@Entity('court_cases')
export class CourtCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  caseNumber: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: CaseType })
  caseType: CaseType;

  @Column({ type: 'enum', enum: CaseStatus, default: CaseStatus.PENDING })
  status: CaseStatus;

  @Column({ type: 'enum', enum: CaseOutcome, default: CaseOutcome.PENDING })
  outcome: CaseOutcome;

  @Column({ type: 'varchar', length: 100 })
  region: string;

  @Column({ type: 'varchar', length: 100 })
  court: string;

  @Column({ type: 'varchar', length: 255 })
  plaintiff: string;

  @Column({ type: 'varchar', length: 255 })
  defendant: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  judge?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  claimAmount?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  settlementAmount?: number;

  @Column({ type: 'date' })
  filedDate: Date;

  @Column({ type: 'date', nullable: true })
  resolvedDate?: Date;

  @Column({ type: 'int', nullable: true })
  daysToResolution?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}