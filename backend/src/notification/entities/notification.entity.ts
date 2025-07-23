import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum NotificationType {
  EMAIL = "EMAIL",
  IN_APP = "IN_APP",
  SMS = "SMS",
  PUSH = "PUSH",
}

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  DELIVERED = "DELIVERED",
  READ = "READ",
}

export enum NotificationPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum NotificationEvent {
  RISK_DETECTED = "RISK_DETECTED",
  HIGH_RISK_DETECTED = "HIGH_RISK_DETECTED",
  CRITICAL_RISK_DETECTED = "CRITICAL_RISK_DETECTED",
  REVIEW_APPROVED = "REVIEW_APPROVED",
  REVIEW_REJECTED = "REVIEW_REJECTED",
  REVIEW_REQUESTED = "REVIEW_REQUESTED",
  DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED",
  DOCUMENT_DELETED = "DOCUMENT_DELETED",
  SYSTEM_ALERT = "SYSTEM_ALERT",
}

@Entity("notifications")
@Index(["recipientId", "status"])
@Index(["type", "status"])
@Index(["event", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  @Index()
  recipientId: string

  @Column()
  recipientEmail: string

  @Column({
    type: "enum",
    enum: NotificationType,
  })
  type: NotificationType

  @Column({
    type: "enum",
    enum: NotificationEvent,
  })
  @Index()
  event: NotificationEvent

  @Column({
    type: "enum",
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  @Index()
  status: NotificationStatus

  @Column({
    type: "enum",
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority

  @Column()
  title: string

  @Column("text")
  message: string

  @Column("jsonb", { nullable: true })
  data: Record<string, any>

  @Column({ nullable: true })
  resourceType: string

  @Column({ nullable: true })
  resourceId: string

  @Column({ nullable: true })
  senderId: string

  @Column({ nullable: true })
  senderEmail: string

  @Column({ nullable: true })
  templateId: string

  @Column({ type: "timestamp", nullable: true })
  scheduledAt: Date

  @Column({ type: "timestamp", nullable: true })
  sentAt: Date

  @Column({ type: "timestamp", nullable: true })
  deliveredAt: Date

  @Column({ type: "timestamp", nullable: true })
  readAt: Date

  @Column({ nullable: true })
  errorMessage: string

  @Column({ default: 0 })
  retryCount: number

  @Column({ default: 3 })
  maxRetries: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
