import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('document_uploads')
export class UploadedDocument {
  @ApiProperty({ description: 'Unique identifier (UUID)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Original filename as provided by the uploader' })
  @Column()
  originalName: string;

  @ApiProperty({ description: 'Absolute server-side path where the file is stored' })
  @Column()
  storagePath: string;

  @ApiProperty({ description: 'MIME type of the uploaded file' })
  @Column()
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @Column({ type: 'bigint' })
  sizeBytes: number;

  @ApiProperty({ description: 'Timestamp when the document was uploaded' })
  @CreateDateColumn()
  uploadedAt: Date;
}
