import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async downloadWithWatermark(
    documentId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['owner'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      throw new NotFoundException('Document file not found on disk');
    }

    // Generate watermark text
    const watermarkText = this.generateWatermarkText(user.fullName, documentId);

    // Read file buffer
    const fileBuffer = fs.readFileSync(document.filePath);

    // Apply watermark based on file type
    let watermarkedBuffer: Buffer;
    
    if (document.mimeType === 'application/pdf') {
      watermarkedBuffer = await this.watermarkPdf(fileBuffer, watermarkText);
    } else if (document.mimeType.startsWith('image/')) {
      watermarkedBuffer = await this.watermarkImage(fileBuffer, watermarkText, document.mimeType);
    } else {
      // Return original file without watermark for unsupported types
      this.logger.warn(`Watermarking not supported for ${document.mimeType}`);
      watermarkedBuffer = fileBuffer;
    }

    return {
      buffer: watermarkedBuffer,
      mimeType: document.mimeType,
      filename: document.title,
    };
  }

  private generateWatermarkText(userName: string, documentId: string): string {
    const timestamp = new Date().toISOString();
    return `${userName} | ${timestamp} | ${documentId}`;
  }

  private async watermarkPdf(buffer: Buffer, watermarkText: string): Promise<Buffer> {
    try {
      const PDFDocumentLib = await import('pdf-lib');
      const PDFDocument = PDFDocumentLib.PDFDocument;
      const StandardFonts = PDFDocumentLib.StandardFonts;
      const rgb = PDFDocumentLib.rgb;

      const pdfDoc = await PDFDocument.load(buffer);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      for (const page of pages) {
        const { width, height } = page.getSize();
        const fontSize = 12;
        
        // Draw watermark diagonally across the page
        const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
        
        page.drawText(watermarkText, {
          x: (width - textWidth) / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.3,
          rotate: PDFDocumentLib.degrees(-45),
        });
      }

      return Buffer.from(await pdfDoc.save());
    } catch (error) {
      this.logger.error('Failed to watermark PDF', error);
      // Return original buffer if watermarking fails
      return buffer;
    }
  }

  private async watermarkImage(
    buffer: Buffer,
    watermarkText: string,
    mimeType: string,
  ): Promise<Buffer> {
    try {
      // For images, we'll use a simple approach with canvas-like manipulation
      // Since we don't have sharp or canvas in dependencies, we'll return the original
      // In production, you'd use sharp or similar library
      this.logger.warn('Image watermarking requires additional dependencies (sharp/canvas)');
      return buffer;
    } catch (error) {
      this.logger.error('Failed to watermark image', error);
      return buffer;
    }
  }
}
