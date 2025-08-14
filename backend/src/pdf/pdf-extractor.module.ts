import { Module } from '@nestjs/common';
import { PdfExtractorService } from './pdf-extractor.service';

@Module({
  providers: [PdfExtractorService],
  exports: [PdfExtractorService],
})
export class PdfExtractorModule {}
