import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ description: 'Unique identifier of the stored document (UUID)' })
  id: string;

  @ApiProperty({ description: 'Original filename as provided by the uploader' })
  originalName: string;

  @ApiProperty({ description: 'Absolute server-side path where the file is stored' })
  storagePath: string;

  @ApiProperty({ description: 'MIME type of the uploaded file' })
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes' })
  sizeBytes: number;

  @ApiProperty({ description: 'Timestamp when the document was uploaded' })
  uploadedAt: Date;
}
