{
  ;`import { IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OcrRequestDto {
  @ApiProperty({ description: 'URL of the document (image or PDF) to perform OCR on' })
  @IsNotEmpty()
  @IsString()
  @IsUrl({ require_tld: false }) // Use require_tld: false for placeholder.svg or local paths
  documentUrl: string;
}

export class OcrResponseDto {
  @ApiProperty({ description: 'The text extracted from the document by OCR' })
  extractedText: string;
}`
}
