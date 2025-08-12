import { Injectable } from '@nestjs/common';
import * as pdf from 'pdf-parse';
import * as Tesseract from 'tesseract.js';
import { fromPath } from 'pdf2pic';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class PdfExtractorService {
  async extractText(filePath: string): Promise<string> {
    // Try native extraction first
    const fileBuffer = await fs.readFile(filePath);
    const nativeData = await pdf(fileBuffer);

    if (nativeData.text.trim()) {
      return nativeData.text.trim();
    }

    // If no text, run OCR (scanned PDF)
    const tempDir = path.join(__dirname, '../../tmp/pdf_images');
    await fs.mkdir(tempDir, { recursive: true });

    const convert = fromPath(filePath, {
      density: 300,
      saveFilename: 'page',
      savePath: tempDir,
      format: 'png',
    });

    let ocrText = '';
    const totalPages = (await pdf(fileBuffer)).numpages;

    for (let i = 1; i <= totalPages; i++) {
      const pageImage = await convert(i);
      const { data: { text } } = await Tesseract.recognize(pageImage.path, 'eng');
      ocrText += text + '\n';
    }

    return ocrText.trim();
  }
}
