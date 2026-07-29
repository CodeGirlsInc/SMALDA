
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class FileValidationPipe implements PipeTransform {
  transform(value: Express.Multer.File) {
    if (!value) {
      throw new BadRequestException('File is required');
    }

    if (value.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(value.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    return value;

import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { PDFDocument, PDFName } from 'pdf-lib';
import sharp = require('sharp');

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

interface DetectedType {
  mime: string;
  ext: string;
}

const BLOCKED_MIME_PREFIXES = [
  'application/zip',
  'application/x-zip',
  'application/x-rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-bzip',
  'application/x-bzip2',
  'application/x-msdownload',
  'application/x-exe',
  'application/x-msdos-program',
  'application/x-sh',
  'application/x-bat',
  'application/javascript',
  'text/javascript',
  'application/x-shellscript',
];

const BLOCKED_EXTENSIONS = [
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.sh',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
];

/**
 * Validates and sanitizes uploaded files by inspecting actual file content
 * (magic bytes) rather than trusting the declared Content-Type or extension.
 *
 * Rejects archives, executables, and files outside the allowlist. Strips
 * metadata from images. Detects PDFs with active content (JavaScript actions
 * or embedded files) and rejects them.
 */
@Injectable()
export class FileValidationPipe
  implements PipeTransform<Express.Multer.File, Promise<Express.Multer.File>>
{
  async transform(file: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    this.validateSize(file);
    this.rejectByExtension(file.originalname);

    const detectedType = this.detectFileType(file.buffer);

    if (!detectedType) {
      throw new BadRequestException(
        'Unable to determine file type from content',
      );
    }

    this.rejectBlockedMimeType(detectedType.mime);

    if (!ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
      throw new BadRequestException(
        `File type ${detectedType.mime} is not allowed`,
      );
    }

    if (detectedType.mime !== file.mimetype) {
      throw new BadRequestException(
        `Declared MIME type ${file.mimetype} does not match actual file type ${detectedType.mime}`,
      );
    }

    if (detectedType.mime === 'application/pdf') {
      await this.validatePdf(file.buffer);
    }

    if (
      detectedType.mime === 'image/png' ||
      detectedType.mime === 'image/jpeg'
    ) {
      file.buffer = await this.stripImageMetadata(file.buffer);
    }

    return file;
  }

  private detectFileType(buffer: Buffer): DetectedType | undefined {
    if (buffer.length < 4) return undefined;

    // PDF
    if (buffer.slice(0, 4).toString('ascii') === '%PDF') {
      return { mime: 'application/pdf', ext: 'pdf' };
    }

    // PNG
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mime: 'image/png', ext: 'png' };
    }

    // JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }

    // ZIP-based formats (including docx, xlsx, etc.)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      return { mime: 'application/zip', ext: 'zip' };
    }

    // RAR
    if (buffer.slice(0, 4).toString('ascii') === 'Rar!') {
      return { mime: 'application/x-rar', ext: 'rar' };
    }

    // 7z
    if (
      buffer[0] === 0x37 &&
      buffer[1] === 0x7a &&
      buffer[2] === 0xbc &&
      buffer[3] === 0xaf
    ) {
      return { mime: 'application/x-7z-compressed', ext: '7z' };
    }

    // GZIP
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return { mime: 'application/gzip', ext: 'gz' };
    }

    // BZIP2
    if (buffer[0] === 0x42 && buffer[1] === 0x5a && buffer[2] === 0x68) {
      return { mime: 'application/x-bzip2', ext: 'bz2' };
    }

    // EXE / DLL
    if (buffer.slice(0, 2).toString('ascii') === 'MZ') {
      return { mime: 'application/x-msdownload', ext: 'exe' };
    }

    // ELF
    if (buffer[0] === 0x7f && buffer.slice(1, 4).toString('ascii') === 'ELF') {
      return { mime: 'application/x-elf', ext: 'elf' };
    }

    return undefined;
  }

  private validateSize(file: Express.Multer.File): void {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`,
      );
    }
  }

  private rejectByExtension(originalname: string): void {
    const lower = originalname.toLowerCase();
    for (const ext of BLOCKED_EXTENSIONS) {
      if (lower.endsWith(ext)) {
        throw new BadRequestException(
          `File extension ${ext} is not allowed`,
        );
      }
    }
  }

  private rejectBlockedMimeType(mime: string): void {
    for (const prefix of BLOCKED_MIME_PREFIXES) {
      if (mime.startsWith(prefix)) {
        throw new BadRequestException(`File type ${mime} is not allowed`);
      }
    }
  }

  private async validatePdf(buffer: Buffer): Promise<void> {
    try {
      const pdf = await PDFDocument.load(buffer, {
        updateMetadata: false,
      });

      // Reject PDFs that carry an EmbeddedFiles name tree.
      const catalog = pdf.catalog;
      const namesRef = catalog.get(PDFName.of('Names'));
      if (namesRef) {
        const names = pdf.context.lookup(namesRef) as any;
        if (names && names.get(PDFName.of('EmbeddedFiles'))) {
          throw new BadRequestException(
            'PDF contains embedded files and is not allowed',
          );
        }
      }

      // Reject pages with actions or additional-actions dictionaries.
      for (const page of pdf.getPages()) {
        const node = page.node as any;
        const actions =
          node.get(PDFName.of('A')) || node.get(PDFName.of('AA'));
        if (actions) {
          throw new BadRequestException(
            'PDF contains active content (JavaScript/actions) and is not allowed',
          );
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid or malformed PDF file');
    }
  }

  private async stripImageMetadata(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer).withMetadata({}).toBuffer();
    } catch {
      throw new BadRequestException('Failed to process image metadata');
    }

  }
}
