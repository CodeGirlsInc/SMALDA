import { IsBoolean } from 'class-validator';

export class ArchiveDocumentDto {
  @IsBoolean()
  archived: boolean;
}
