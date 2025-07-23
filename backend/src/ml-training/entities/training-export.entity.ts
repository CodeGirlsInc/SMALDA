import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

export enum ExportFormat {
  JSON = "json",
  CSV = "csv",
  JSONL = "jsonl",
  PARQUET = "parquet",
}

export enum ExportStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("training_exports")
export class TrainingExport {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "varchar", length: 255 })
  name: string

  @Column({ type: "text", nullable: true })
  description: string

  @Column({
    type: "enum",
    enum: ExportFormat,
    default: ExportFormat.JSON,
  })
  format: ExportFormat

  @Column({
    type: "enum",
    enum: ExportStatus,
    default: ExportStatus.PENDING,
  })
  status: ExportStatus

  @Column({ type: "jsonb" })
  filters: Record<string, any>

  @Column({ type: "integer", default: 0 })
  recordCount: number

  @Column({ type: "varchar", length: 500, nullable: true })
  filePath: string

  @Column({ type: "bigint", nullable: true })
  fileSizeBytes: number

  @Column({ type: "uuid" })
  exportedBy: string

  @Column({ type: "varchar", length: 255 })
  exporterName: string

  @Column({ type: "text", nullable: true })
  errorMessage: string

  @CreateDateColumn()
  createdAt: Date

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date
}
