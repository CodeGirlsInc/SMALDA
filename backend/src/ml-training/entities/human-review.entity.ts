import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm"
import { DatasetRecord, RiskLevel } from "./dataset-record.entity"

export enum ReviewStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  ESCALATED = "escalated",
}

export enum ReviewDecision {
  APPROVE = "approve",
  REJECT = "reject",
  MODIFY = "modify",
  ESCALATE = "escalate",
}

@Entity("human_reviews")
export class HumanReview {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  reviewerId: string

  @Column({ type: "varchar", length: 255 })
  reviewerName: string

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
    type: "enum",
    enum: RiskLevel,
    nullable: true,
  })
  reviewedRiskLevel: RiskLevel

  @Column({ type: "text", nullable: true })
  comments: string

  @Column({ type: "jsonb", nullable: true })
  corrections: Record<string, any>

  @Column({ type: "integer", min: 1, max: 5, nullable: true })
  qualityRating: number

  @Column({ type: "integer", nullable: true })
  timeSpentMinutes: number

  @Column({ default: false })
  requiresSecondReview: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(
    () => DatasetRecord,
    (datasetRecord) => datasetRecord.humanReviews,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "datasetRecordId" })
  datasetRecord: DatasetRecord
}
