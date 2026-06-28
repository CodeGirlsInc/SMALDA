import { Document, DocumentStatus } from '../entities/document.entity';

export class DocumentResponseDto {
  id: string;
  ownerId: string;
  title: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  status: string;
  riskScore?: number;
  riskFlags?: string[];
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;

  static from(entity: Document): DocumentResponseDto {
    return {
      id: entity.id,
      ownerId: entity.ownerId,
      title: entity.title,
      fileHash: entity.fileHash,
      fileSize: entity.fileSize,
      mimeType: entity.mimeType,
      status: entity.status,
      riskScore: entity.riskScore,
      riskFlags: entity.riskFlags,
      archived: entity.archived,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
