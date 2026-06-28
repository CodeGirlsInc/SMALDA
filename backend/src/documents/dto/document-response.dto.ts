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
}
