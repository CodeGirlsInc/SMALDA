import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { DatasetTag } from "./dataset-tag.entity"
import { HumanReview } from "./human-review.entity"
import { Feedback } from "./feedback.entity"

export enum DatasetStatus {
  PENDING = "pending",
  REVIEWED = "reviewed",
  APPROVED = "approved",
  REJECTED = "rejected",
  TRAINING = "training",
  COMPLETED = "completed",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

@Entity("dataset_records")
export class DatasetRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "text" })
  inputData: string

  @Column({ type: "jsonb", nullable: true })
  features: Record<string, any>

  @Column({
    type: "enum",
    enum: RiskLevel,
    nullable: true,
  })
  predictedRiskLevel: RiskLevel

  @Column({
    type: "enum",
    enum: RiskLevel,
    nullable: true,
  })
  actualRiskLevel: RiskLevel

  @Column({ type: "decimal", precision: 5, scale: 4, nullable: true })
  confidenceScore: number

  @Column({
    type: "enum",
    enum: DatasetStatus,
    default: DatasetStatus.PENDING,
  })
  status: DatasetStatus

  @Column({ type: "text", nullable: true })
  notes: string

  @Column({ type: "uuid", nullable: true })
  sourceTransactionId: string

  @Column({ type: "uuid", nullable: true })
  modelVersion: string

  @Column({ default: false })
  isTrainingData: boolean

  @Column({ default: false })
  isValidationData: boolean

  @Column({ default: false })
  isTestData: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(
    () => DatasetTag,
    (tag) => tag.datasetRecord,
    { cascade: true },
  )
  tags: DatasetTag[]

  @OneToMany(
    () => HumanReview,
    (review) => review.datasetRecord,
    { cascade: true },
  )
  humanReviews: HumanReview[]

  @OneToMany(
    () => Feedback,
    (feedback) => feedback.datasetRecord,
    { cascade: true },
  )
  feedback: Feedback[]
}
