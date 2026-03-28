import { DocumentStatus } from '../entities/document.entity';

export class DocumentDto {
  id: string;
  ownerId: string;
  title: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  riskScore?: number | null;
  riskFlags?: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PaginatedDocumentsDto {
  data: DocumentDto[];
  total: number;
  page: number;
  limit: number;
}
