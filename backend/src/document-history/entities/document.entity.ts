import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  ManyToOne, // NEW
} from "typeorm"
import { DocumentType } from "../enums/document-type.enum"
import { DocumentVersion } from "./document-version.entity"
import { Tag } from "../../tagging/entities/tag.entity"
import { PropertyOwner } from "../../property-owner/entities/property-owner.entity" // NEW
import { ApiProperty } from "@nestjs/swagger"

@Entity("documents")
export class Document {
  @ApiProperty({ description: "Unique identifier for the document" })
  @PrimaryGeneratedColumn("uuid")
  id: string

  @ApiProperty({ description: "Name of the document" })
  @Column({ type: "varchar", length: 255 })
  name: string

  @ApiProperty({ description: "Description of the document", nullable: true })
  @Column({ type: "text", nullable: true })
  description?: string

  @ApiProperty({ enum: DocumentType, description: "Type of the document (e.g., survey_plan, agreement)" })
  @Column({ type: "enum", enum: DocumentType })
  documentType: DocumentType

  @ApiProperty({ description: "ID of the user or entity that owns this document", nullable: true, format: "uuid" })
  @Column({ type: "uuid", nullable: true })
  ownerId?: string // e.g., the user who uploaded it, or a case ID

  @ApiProperty({
    description: "ID of the property owner associated with this document",
    nullable: true,
    format: "uuid",
  }) // NEW
  @Column({ type: "uuid", nullable: true })
  propertyOwnerId?: string // NEW

  @ApiProperty({ type: () => PropertyOwner, description: "The property owner associated with this document" }) // NEW
  @ManyToOne(
    () => PropertyOwner,
    (propertyOwner) => propertyOwner.documents,
    { onDelete: "SET NULL" },
  ) // NEW
  @JoinColumn({ name: "propertyOwnerId" })
  owner: PropertyOwner // NEW

  @ApiProperty({ description: "ID of the current active version of this document", nullable: true, format: "uuid" })
  @Column({ type: "uuid", nullable: true })
  currentVersionId?: string

  @ApiProperty({ type: () => DocumentVersion, description: "The current active version of the document" })
  @OneToOne(() => DocumentVersion, { eager: true, onDelete: "SET NULL" }) // Eager load current version
  @JoinColumn({ name: "currentVersionId" })
  currentVersion: DocumentVersion

  @ApiProperty({ type: () => [DocumentVersion], description: "All historical versions of this document" })
  @OneToMany(
    () => DocumentVersion,
    (version) => version.document,
    { cascade: true },
  )
  versions: DocumentVersion[]

  @ApiProperty({ type: () => [Tag], description: "Tags associated with the document", isArray: true })
  @ManyToMany(
    () => Tag,
    (tag) => tag.documents,
    { cascade: true },
  )
  @JoinTable({
    name: "document_tags",
    joinColumn: { name: "documentId", referencedColumnName: "id" },
    inverseJoinColumn: { name: "tagId", referencedColumnName: "id" },
  })
  tags: Tag[]

  @ApiProperty({ description: "Timestamp when the document was created" })
  @CreateDateColumn({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date

  @ApiProperty({
    description: "Timestamp when the document was last updated (i.e., a new version was created or metadata changed)",
  })
  @UpdateDateColumn({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date

  @ApiProperty({ description: "Timestamp when the document was soft-deleted", nullable: true })
  @DeleteDateColumn({ type: "timestamp with time zone", nullable: true })
  deletedAt?: Date
}
