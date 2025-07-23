import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm"
import { DatasetRecord } from "./dataset-record.entity"

export enum TagCategory {
  RISK_INDICATOR = "risk_indicator",
  TRANSACTION_TYPE = "transaction_type",
  CUSTOMER_SEGMENT = "customer_segment",
  GEOGRAPHIC = "geographic",
  TEMPORAL = "temporal",
  BEHAVIORAL = "behavioral",
  CUSTOM = "custom",
}

@Entity("dataset_tags")
export class DatasetTag {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "varchar", length: 100 })
  name: string

  @Column({ type: "varchar", length: 255, nullable: true })
  value: string

  @Column({
    type: "enum",
    enum: TagCategory,
    default: TagCategory.CUSTOM,
  })
  category: TagCategory

  @Column({ type: "text", nullable: true })
  description: string

  @Column({ type: "decimal", precision: 3, scale: 2, nullable: true })
  weight: number

  @Column({ type: "uuid" })
  createdBy: string

  @CreateDateColumn()
  createdAt: Date

  @ManyToOne(
    () => DatasetRecord,
    (datasetRecord) => datasetRecord.tags,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "datasetRecordId" })
  datasetRecord: DatasetRecord
}
