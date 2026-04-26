import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDocumentNoteDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(10000) // Reasonable limit for note content
  content: string;
}