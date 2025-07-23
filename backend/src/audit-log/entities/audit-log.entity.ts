import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"

export enum AuditAction {
  // Document actions
  UPLOAD_DOCUMENT = "UPLOAD_DOCUMENT",
  VIEW_DOCUMENT = "VIEW_DOCUMENT",
  DOWNLOAD_DOCUMENT = "DOWNLOAD_DOCUMENT",
  DELETE_DOCUMENT = "DELETE_DOCUMENT",

  // Risk analysis actions
  ANALYZE_DOCUMENT = "ANALYZE_DOCUMENT",
  REANALYZE_DOCUMENT = "REANALYZE_DOCUMENT",
  FLAG_RISK = "FLAG_RISK",
  DELETE_RISK_ANALYSIS = "DELETE_RISK_ANALYSIS",

  // Review and approval actions
  APPROVE_REVIEW = "APPROVE_REVIEW",
  REJECT_REVIEW = "REJECT_REVIEW",
  REQUEST_REVIEW = "REQUEST_REVIEW",

  // System actions
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  ACCESS_DENIED = "ACCESS_DENIED",
  SYSTEM_ERROR = "SYSTEM_ERROR",
}

export enum AuditSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

@Entity("audit_logs")
@Index(["userId", "createdAt"])
@Index(["action", "createdAt"])
@Index(["resourceType", "resourceId"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  @Index()
  userId: string

  @Column()
  userEmail: string

  @Column({
    type: "enum",
    enum: AuditAction,
  })
  @Index()
  action: AuditAction

  @Column({
    type: "enum",
    enum: AuditSeverity,
    default: AuditSeverity.LOW,
  })
  severity: AuditSeverity

  @Column()
  description: string

  @Column({ nullable: true })
  resourceType: string // 'document', 'risk_analysis', 'user', etc.

  @Column({ nullable: true })
  @Index()
  resourceId: string

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>

  @Column({ nullable: true })
  ipAddress: string

  @Column({ nullable: true })
  userAgent: string

  @Column({ default: true })
  success: boolean

  @Column({ nullable: true })
  errorMessage: string

  @CreateDateColumn()
  @Index()
  createdAt: Date
}
