import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum ValidationType {
  LAND_REGISTRY = "LAND_REGISTRY",
  GOVERNMENT_ID = "GOVERNMENT_ID",
  BUSINESS_REGISTRATION = "BUSINESS_REGISTRATION",
  TAX_VERIFICATION = "TAX_VERIFICATION",
  CUSTOMS_CLEARANCE = "CUSTOMS_CLEARANCE",
  SHIPPING_MANIFEST = "SHIPPING_MANIFEST",
  CERTIFICATE_AUTHORITY = "CERTIFICATE_AUTHORITY",
  INSURANCE_VERIFICATION = "INSURANCE_VERIFICATION",
}

export enum ValidationStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

export enum ValidationResult {
  VALID = "VALID",
  INVALID = "INVALID",
  PARTIAL = "PARTIAL",
  INCONCLUSIVE = "INCONCLUSIVE",
  ERROR = "ERROR",
}

@Entity("validation_requests")
@Index(["documentId", "validationType"])
@Index(["status", "createdAt"])
@Index(["externalReferenceId"])
export class ValidationRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  documentId: string

  @Column({
    type: "enum",
    enum: ValidationType,
  })
  validationType: ValidationType

  @Column({
    type: "enum",
    enum: ValidationStatus,
    default: ValidationStatus.PENDING,
  })
  status: ValidationStatus

  @Column({
    type: "enum",
    enum: ValidationResult,
    nullable: true,
  })
  result: ValidationResult

  @Column({ nullable: true })
  externalReferenceId: string

  @Column({ nullable: true })
  externalApiEndpoint: string

  @Column("jsonb")
  requestPayload: Record<string, any>

  @Column("jsonb", { nullable: true })
  responsePayload: Record<string, any>

  @Column("jsonb", { nullable: true })
  validationDetails: Record<string, any>

  @Column({ nullable: true })
  errorMessage: string

  @Column({ nullable: true })
  requestedBy: string

  @Column({ type: "timestamp", nullable: true })
  validatedAt: Date

  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date

  @Column("decimal", { precision: 3, scale: 2, nullable: true })
  confidenceScore: number

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
