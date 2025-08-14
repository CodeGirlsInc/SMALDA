import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PdfExtractorService } from './pdf-extractor.service';
import { diskStorage } from 'multer';
import * as path from 'path';

@Controller('pdf-extractor')
export class PdfExtractorController {
  constructor(private readonly pdfExtractorService: PdfExtractorService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
      }
    })
  }))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    const text = await this.pdfExtractorService.extractText(file.path);
    return { text };
  }
}
