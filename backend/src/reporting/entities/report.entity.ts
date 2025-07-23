import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum ReportType {
  DOCUMENT_ANALYSIS = "DOCUMENT_ANALYSIS",
  RISK_SUMMARY = "RISK_SUMMARY",
  AUDIT_TRAIL = "AUDIT_TRAIL",
  USER_ACTIVITY = "USER_ACTIVITY",
  SYSTEM_OVERVIEW = "SYSTEM_OVERVIEW",
  COMPLIANCE = "COMPLIANCE",
}

export enum ReportFormat {
  PDF = "PDF",
  CSV = "CSV",
  EXCEL = "EXCEL",
  JSON = "JSON",
}

export enum ReportStatus {
  PENDING = "PENDING",
  GENERATING = "GENERATING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}

@Entity("reports")
@Index(["generatedBy", "createdAt"])
@Index(["type", "status"])
export class Report {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({
    type: "enum",
    enum: ReportType,
  })
  @Index()
  type: ReportType

  @Column({
    type: "enum",
    enum: ReportFormat,
  })
  format: ReportFormat

  @Column({
    type: "enum",
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  @Index()
  status: ReportStatus

  @Column()
  title: string

  @Column("text", { nullable: true })
  description: string

  @Column("jsonb")
  parameters: Record<string, any>

  @Column()
  @Index()
  generatedBy: string

  @Column()
  generatedByEmail: string

  @Column({ nullable: true })
  filePath: string

  @Column({ nullable: true })
  fileName: string

  @Column({ default: 0 })
  fileSize: number

  @Column({ nullable: true })
  downloadUrl: string

  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date

  @Column({ default: 0 })
  downloadCount: number

  @Column({ nullable: true })
  errorMessage: string

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
