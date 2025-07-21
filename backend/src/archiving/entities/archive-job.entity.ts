import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum JobStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum JobType {
  ARCHIVE_DOCUMENTS = "ARCHIVE_DOCUMENTS",
  RESTORE_DOCUMENTS = "RESTORE_DOCUMENTS",
  CLEANUP_ARCHIVES = "CLEANUP_ARCHIVES",
  POLICY_EVALUATION = "POLICY_EVALUATION",
}

@Entity("archive_jobs")
@Index(["status", "jobType"])
@Index(["scheduledAt", "status"])
@Index(["createdAt"])
export class ArchiveJob {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({
    type: "enum",
    enum: JobType,
  })
  jobType: JobType

  @Column({
    type: "enum",
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  status: JobStatus

  @Column({ nullable: true })
  policyId: string

  @Column("jsonb", { nullable: true })
  jobParameters: Record<string, any>

  @Column({ type: "timestamp", nullable: true })
  scheduledAt: Date

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date

  @Column({ default: 0 })
  documentsProcessed: number

  @Column({ default: 0 })
  documentsSucceeded: number

  @Column({ default: 0 })
  documentsFailed: number

  @Column("jsonb", { nullable: true })
  results: Record<string, any>

  @Column({ nullable: true })
  errorMessage: string

  @Column("jsonb", { nullable: true })
  errorDetails: Record<string, any>

  @Column({ nullable: true })
  triggeredBy: string

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
