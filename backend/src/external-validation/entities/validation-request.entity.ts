import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
  ERROR = 'ERROR',
}

export enum ValidationType {
  LAND_REGISTRY = 'LAND_REGISTRY',
  GOVERNMENT_ID = 'GOVERNMENT_ID',
  BUSINESS_REGISTRATION = 'BUSINESS_REGISTRATION',
}

@Entity('validation_requests')
export class ValidationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column({ type: 'enum', enum: ValidationType })
  validationType: ValidationType;

  @Column({ type: 'jsonb', nullable: true })
  requestPayload: Record<string, any>;

  @Column()
  requestedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'enum', enum: ValidationStatus, default: ValidationStatus.PENDING })
  status: ValidationStatus;

  @Column({ type: 'enum', enum: ValidationResult, nullable: true })
  result: ValidationResult | null;

  @Column({ type: 'jsonb', nullable: true })
  responsePayload: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  validationDetails: Record<string, any> | null;

  @Column({ type: 'timestamptz', nullable: true })
  validatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'float', nullable: true })
  confidenceScore: number | null;

  @Column({ nullable: true })
  externalReferenceId: string | null;

  @Column({ nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('validation_providers')
export class ValidationProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ValidationType })
  validationType: ValidationType;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
