import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const MAX_DOCUMENT_TITLE_LENGTH = 200;

export class UploadDocumentDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_DOCUMENT_TITLE_LENGTH)
  title?: string;
}
