import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { RiskStatus } from '../enums/risk-status.enum';
import { ApiProperty } from '@nestjs/swagger';

@Entity('document_versions')
export class DocumentVersion {
  @ApiProperty({ description: 'Unique identifier for the document version' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Foreign key to the parent document', format: 'uuid' })
  @Column({ type: 'uuid' })
  documentId: string;

  @ApiProperty({ type: () => Document, description: 'The parent document this version belongs to' })
  @ManyToOne(() => Document, (document) => document.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @ApiProperty({ description: 'Sequential version number for this document' })
  @Column({ type: 'int' })
  versionNumber: number;

  @ApiProperty({ description: 'ID of the user who uploaded/edited this version', format: 'uuid' })
  @Column({ type: 'uuid' })
  uploadedBy: string;

  @ApiProperty({ description: 'Notes about this specific version upload or edit', nullable: true })
  @Column({ type: 'text', nullable: true })
  uploadNotes?: string;

  @ApiProperty({ description: 'URL or path to the actual document file for this version' })
  @Column({ type: 'varchar', length: 512 })
  documentUrl: string;

  @ApiProperty({ description: 'Structured JSON data of the risk report for this version', type: 'object', additionalProperties: true })
  @Column({ type: 'jsonb' })
  riskReport: Record<string, any>;

  @ApiProperty({ description: 'A brief summary of the risks identified in this version', nullable: true })
  @Column({ type: 'text', nullable: true })
  riskSummary?: string;

  @ApiProperty({ enum: RiskStatus, description: 'Overall risk status for this document version' })
  @Column({ type: 'enum', enum: RiskStatus })
  riskStatus: RiskStatus;

  @ApiProperty({ description: 'Extracted text content from the document using OCR', nullable: true })
  @Column({ type: 'text', nullable: true })
  extractedText?: string; // NEW FIELD

  @ApiProperty({ description: 'Timestamp when this version was created' })
  @CreateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when this version was soft-deleted (if parent document is deleted)', nullable: true })
  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
  deletedAt?: Date;
}
