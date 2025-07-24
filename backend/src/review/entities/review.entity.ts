import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from "typeorm"
import { ReviewStatus, ReviewDecision, RiskLevel } from "../enums/review.enums"
import { ReviewComment } from "./review-comment.entity"
import { User } from "../../user/entities/user.entity"
import { Document } from "../../document/entities/document.entity"

@Entity("reviews")
@Index(["documentId", "status"])
@Index(["reviewerId", "createdAt"])
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "document_id", type: "uuid" })
  documentId: string

  @Column({ name: "reviewer_id", type: "uuid" })
  reviewerId: string

  @Column({
    type: "enum",
    enum: ReviewStatus,
    default: ReviewStatus.PENDING,
  })
  status: ReviewStatus

  @Column({
    type: "enum",
    enum: ReviewDecision,
    nullable: true,
  })
  decision: ReviewDecision

  @Column({
    name: "ai_risk_level",
    type: "enum",
    enum: RiskLevel,
  })
  aiRiskLevel: RiskLevel

  @Column({
    name: "ai_confidence_score",
    type: "decimal",
    precision: 5,
    scale: 4,
  })
  aiConfidenceScore: number

  @Column({
    name: "ai_detection_details",
    type: "jsonb",
  })
  aiDetectionDetails: Record<string, any>

  @Column({
    name: "reviewer_risk_level",
    type: "enum",
    enum: RiskLevel,
    nullable: true,
  })
  reviewerRiskLevel: RiskLevel

  @Column({
    name: "reviewer_notes",
    type: "text",
    nullable: true,
  })
  reviewerNotes: string

  @Column({
    name: "review_metadata",
    type: "jsonb",
    default: {},
  })
  reviewMetadata: Record<string, any>

  @Column({
    name: "time_spent_minutes",
    type: "integer",
    nullable: true,
  })
  timeSpentMinutes: number

  @Column({
    name: "escalation_reason",
    type: "text",
    nullable: true,
  })
  escalationReason: string

  @Column({
    name: "is_escalated",
    type: "boolean",
    default: false,
  })
  isEscalated: boolean

  @Column({
    name: "priority_level",
    type: "integer",
    default: 1,
  })
  priorityLevel: number

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date

  @Column({
    name: "reviewed_at",
    type: "timestamp",
    nullable: true,
  })
  reviewedAt: Date

  @Column({
    name: "due_date",
    type: "timestamp",
    nullable: true,
  })
  dueDate: Date

  // Relations
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "reviewer_id" })
  reviewer: User

  @ManyToOne(() => Document, { eager: true })
  @JoinColumn({ name: "document_id" })
  document: Document

  @OneToMany(
    () => ReviewComment,
    (comment) => comment.review,
    {
      cascade: true,
      eager: false,
    },
  )
  comments: ReviewComment[]
}
