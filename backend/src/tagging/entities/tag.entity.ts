import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
} from "typeorm"
import { Document } from "../../document-history/entities/document.entity"
import { ApiProperty } from "@nestjs/swagger"

@Entity("tags")
export class Tag {
  @ApiProperty({ description: "Unique identifier for the tag" })
  @PrimaryGeneratedColumn("uuid")
  id: string

  @ApiProperty({ description: "Name of the tag (must be unique)" })
  @Column({ type: "varchar", length: 100, unique: true })
  name: string

  @ApiProperty({ description: "Timestamp when the tag was created" })
  @CreateDateColumn({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date

  @ApiProperty({ description: "Timestamp when the tag was last updated" })
  @UpdateDateColumn({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date

  @ApiProperty({ description: "Timestamp when the tag was soft-deleted", nullable: true })
  @DeleteDateColumn({ type: "timestamp with time zone", nullable: true })
  deletedAt?: Date

  @ManyToMany(
    () => Document,
    (document) => document.tags,
  )
  documents: Document[]
}
