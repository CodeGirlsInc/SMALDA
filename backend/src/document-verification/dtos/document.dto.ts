import { DocumentStatus } from '../enums/document-status.enum';

export class CreateDocumentDto {
  title: string;
  description?: string;
  submittedBy: string;
}

export class UpdateDocumentStatusDto {
  status: DocumentStatus;
  rejectionReason?: string;
  reviewedBy: string;
}

export class DocumentResponseDto {
  id: string;
  title: string;
  description?: string;
  submittedBy: string;
  reviewedBy?: string;
  status: DocumentStatus;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
