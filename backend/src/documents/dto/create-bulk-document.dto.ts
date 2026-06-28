import { CreateDocumentDto } from './create-document.dto';

export class CreateBulkDocumentDto {
  documents: CreateDocumentDto[];
}
