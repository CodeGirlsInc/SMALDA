import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm"
import { DatasetRecord } from "./dataset-record.entity"

export enum FeedbackType {
  ACCURACY = "accuracy",
  RELEVANCE = "relevance",
  COMPLETENESS = "completeness",
  QUALITY = "quality",
  GENERAL = "general",
}

export enum FeedbackSource {
  HUMAN_REVIEWER = "human_reviewer",
  AUTOMATED_SYSTEM = "automated_system",
  CUSTOMER = "customer",
  ANALYST = "analyst",
  EXTERNAL_API = "external_api",
}

@Entity("feedback")
export class Feedback {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({
    type: "enum",
    enum: FeedbackType,
    default: FeedbackType.GENERAL,
  })
  type: FeedbackType

  @Column({
    type: "enum",
    enum: FeedbackSource,
    default: FeedbackSource.HUMAN_REVIEWER,
  })
  source: FeedbackSource

  @Column({ type: "integer", min: 1, max: 5 })
  rating: number

  @Column({ type: "text", nullable: true })
  comments: string

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "uuid", nullable: true })
  submittedBy: string

  @Column({ type: "varchar", length: 255, nullable: true })
  submitterName: string

  @Column({ default: true })
  isUsefulForTraining: boolean

  @CreateDateColumn()
  createdAt: Date

  @ManyToOne(
    () => DatasetRecord,
    (datasetRecord) => datasetRecord.feedback,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "datasetRecordId" })
  datasetRecord: DatasetRecord
}
