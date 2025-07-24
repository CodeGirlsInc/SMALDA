{
  ;`import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OcrExtractionService } from './ocr-extraction.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { OcrRequestDto, OcrResponseDto } from './dto/ocr-extraction.dto';

@ApiTags('OCR Extraction')
@Controller('ocr-extraction')
export class OcrExtractionController {
  constructor(private readonly ocrExtractionService: OcrExtractionService) {}

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extract text from a document URL using OCR' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Text successfully extracted.', type: OcrResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input URL.' })
  @ApiBody({ type: OcrRequestDto, description: 'URL of the document to perform OCR on' })
  async extractText(@Body() ocrRequestDto: OcrRequestDto): Promise<OcrResponseDto> {
    const extractedText = await this.ocrExtractionService.extractText(ocrRequestDto.documentUrl);
    return { extractedText };
  }
}`
}
