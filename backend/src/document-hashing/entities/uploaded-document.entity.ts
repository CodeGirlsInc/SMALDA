import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('uploaded_documents')
export class UploadedDocument {
  @ApiProperty({ description: 'Unique identifier (UUID)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Original filename as provided by the uploader' })
  @Column()
  originalName: string;

  @ApiProperty({ description: 'Absolute path to the file on disk' })
  @Column()
  filePath: string;

  @ApiPropertyOptional({ description: 'MIME type of the uploaded file' })
  @Column({ nullable: true })
  mimeType: string | null;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @Column({ type: 'bigint', nullable: true })
  size: number | null;

  // Populated by DocumentHashingService.hashAndStore() after upload — not set during initial record creation
  @ApiPropertyOptional({
    description: 'Hex-encoded SHA-256 fingerprint of the file, computed post-upload',
  })
  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  sha256Hash: string | null;

  @ApiProperty({ description: 'Timestamp when the document was uploaded' })
  @CreateDateColumn()
  uploadedAt: Date;
}
