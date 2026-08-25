import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ValidationType {
  LAND_REGISTRY = 'LAND_REGISTRY',
  GOVERNMENT_ID = 'GOVERNMENT_ID',
  BUSINESS_REGISTRATION = 'BUSINESS_REGISTRATION',
}

export enum ValidationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum ValidationResult {
  VALID = 'VALID',
  INVALID = 'INVALID',
  UNSURE = 'UNSURE',
  ERROR = 'ERROR',
}

@Entity('validation_requests')
@Index('IDX_VALIDATION_DOCUMENT', ['documentId'])
@Index('IDX_VALIDATION_STATUS', ['status'])
export class ValidationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column({ type: 'enum', enum: ValidationType })
  validationType: ValidationType;

  @Column({ type: 'jsonb' })
  requestPayload: Record<string, any>;

  @Column()
  requestedBy: string;

  @Column({ type: 'enum', enum: ValidationStatus })
  status: ValidationStatus;

  @Column({ type: 'enum', enum: ValidationResult, nullable: true })
  result: ValidationResult | null;

  @Column({ type: 'jsonb', nullable: true })
  responsePayload: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  validatedAt: Date | null;
}
