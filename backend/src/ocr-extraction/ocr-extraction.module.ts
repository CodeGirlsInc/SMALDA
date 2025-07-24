{
  ;`import { Module } from '@nestjs/common';
import { OcrExtractionService } from './ocr-extraction.service';
import { OcrExtractionController } from './ocr-extraction.controller';

@Module({
  controllers: [OcrExtractionController],
  providers: [OcrExtractionService],
  exports: [OcrExtractionService], // Export so DocumentHistoryModule can use it
})
export class OcrExtractionModule {}`
}
