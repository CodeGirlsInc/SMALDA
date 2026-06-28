export class CreateDocumentDto {
  title: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  ownerId?: string;
  status?: string;
}
