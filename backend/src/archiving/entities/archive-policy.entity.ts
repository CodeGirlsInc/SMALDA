import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum PolicyStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DRAFT = "DRAFT",
}

export enum PolicyTrigger {
  TIME_BASED = "TIME_BASED",
  SIZE_BASED = "SIZE_BASED",
  MANUAL = "MANUAL",
  EVENT_BASED = "EVENT_BASED",
}

@Entity("archive_policies")
@Index(["documentType", "status"])
@Index(["isActive", "priority"])
export class ArchivePolicy {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  name: string

  @Column()
  description: string

  @Column({ nullable: true })
  documentType: string

  @Column({
    type: "enum",
    enum: PolicyTrigger,
  })
  trigger: PolicyTrigger

  @Column({
    type: "enum",
    enum: PolicyStatus,
    default: PolicyStatus.ACTIVE,
  })
  status: PolicyStatus

  @Column({ default: true })
  isActive: boolean

  @Column({ default: 0 })
  priority: number

  // Time-based settings
  @Column({ default: 180 }) // 6 months in days
  inactivityPeriodDays: number

  @Column({ default: 365 }) // 1 year
  retentionPeriodDays: number

  // Size-based settings
  @Column("bigint", { nullable: true })
  maxStorageSize: number

  @Column({ nullable: true })
  maxDocumentCount: number

  // Archive settings
  @Column({ default: true })
  compressOnArchive: boolean

  @Column({ default: false })
  moveToExternalStorage: boolean

  @Column({ nullable: true })
  externalStorageConfig: string

  // Conditions
  @Column("jsonb", { nullable: true })
  conditions: Record<string, any>

  // Actions
  @Column("jsonb", { nullable: true })
  archiveActions: Record<string, any>

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>

  @Column({ nullable: true })
  createdBy: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
