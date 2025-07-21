import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum ArchiveReason {
  INACTIVE_PERIOD = "INACTIVE_PERIOD",
  MANUAL_ARCHIVE = "MANUAL_ARCHIVE",
  POLICY_COMPLIANCE = "POLICY_COMPLIANCE",
  STORAGE_OPTIMIZATION = "STORAGE_OPTIMIZATION",
  LEGAL_REQUIREMENT = "LEGAL_REQUIREMENT",
  EXPIRED_DOCUMENT = "EXPIRED_DOCUMENT",
}

export enum ArchiveStatus {
  ARCHIVED = "ARCHIVED",
  RESTORING = "RESTORING",
  RESTORED = "RESTORED",
  PERMANENTLY_DELETED = "PERMANENTLY_DELETED",
}

@Entity("archived_documents")
@Index(["originalDocumentId"])
@Index(["archivedAt", "archiveReason"])
@Index(["status", "archivedAt"])
@Index(["documentType", "archivedAt"])
export class ArchivedDocument {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  originalDocumentId: string

  @Column()
  originalTableName: string

  @Column("jsonb")
  originalDocumentData: Record<string, any>

  @Column({
    type: "enum",
    enum: ArchiveReason,
  })
  archiveReason: ArchiveReason

  @Column({
    type: "enum",
    enum: ArchiveStatus,
    default: ArchiveStatus.ARCHIVED,
  })
  status: ArchiveStatus

  @Column({ nullable: true })
  documentType: string

  @Column({ nullable: true })
  shipmentId: string

  @Column({ nullable: true })
  uploadedBy: string

  @Column({ nullable: true })
  archivedBy: string

  @Column({ nullable: true })
  restoredBy: string

  @Column({ type: "timestamp", nullable: true })
  restoredAt: Date

  @Column({ nullable: true })
  archiveLocation: string

  @Column("bigint", { nullable: true })
  originalFileSize: number

  @Column({ nullable: true })
  compressionRatio: number

  @Column("jsonb", { nullable: true })
  archiveMetadata: Record<string, any>

  @Column({ type: "timestamp", nullable: true })
  scheduledDeletionAt: Date

  @Column({ default: false })
  isPermanentlyDeleted: boolean

  @CreateDateColumn()
  archivedAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
