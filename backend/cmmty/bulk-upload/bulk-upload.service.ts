import { Injectable, BadRequestException } from '@nestjs/common';
import { DocumentsService } from '../../src/documents/documents.service';
import { QueueService } from '../../src/queue/queue.service';
import { DocumentStatus } from '../../src/documents/entities/document.entity';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 10;

export interface BulkUploadResult {
  succeeded: Array<{
    id: string;
    title: string;
    status: DocumentStatus;
  }>;
  failed: Array<{
    filename: string;
    error: string;
  }>;
}

@Injectable()
export class BulkUploadService {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly queueService: QueueService,
  ) {}

  async processBulkUpload(
    files: Express.Multer.File[],
    userId: string,
    uploadDir: string,
  ): Promise<BulkUploadResult> {
    if (files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    if (files.length > MAX_FILES_PER_BATCH) {
      throw new BadRequestException(`Maximum ${MAX_FILES_PER_BATCH} files allowed per batch`);
    }

    await fs.mkdir(uploadDir, { recursive: true });

    const result: BulkUploadResult = {
      succeeded: [],
      failed: [],
    };

    for (const file of files) {
      try {
        const document = await this.processSingleFile(file, userId, uploadDir);
        result.succeeded.push({
          id: document.id,
          title: document.title,
          status: document.status,
        });
      } catch (error) {
        result.failed.push({
          filename: file.originalname,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  private async processSingleFile(
    file: Express.Multer.File,
    userId: string,
    uploadDir: string,
  ) {
    this.validateFile(file);

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.documentsService.findByFileHash(fileHash);
    
    if (existing) {
      return existing;
    }

    const extension = extname(file.originalname) || '';
    const filename = `${fileHash}${extension}`;
    const targetPath = join(uploadDir, filename);
    await fs.writeFile(targetPath, file.buffer);

    const document = await this.documentsService.create({
      ownerId: userId,
      title: file.originalname,
      filePath: targetPath,
      fileHash,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: DocumentStatus.PENDING,
    });

    await this.queueService.enqueueAnalyze(document.id);
    return document;
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File ${file.originalname} has invalid MIME type. Only PDF, PNG, or JPEG files are allowed`,
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File ${file.originalname} exceeds maximum size of 20MB`,
      );
    }
  }

  validateBatch(files: Express.Multer.File[]): void {
    if (files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    if (files.length > MAX_FILES_PER_BATCH) {
      throw new BadRequestException(`Maximum ${MAX_FILES_PER_BATCH} files allowed per batch`);
    }

    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      const filenames = oversizedFiles.map(f => f.originalname).join(', ');
      throw new BadRequestException(
        `Files exceed maximum size of 20MB: ${filenames}`,
      );
    }

    const invalidMimeFiles = files.filter(file => !ALLOWED_MIME_TYPES.includes(file.mimetype));
    if (invalidMimeFiles.length > 0) {
      const filenames = invalidMimeFiles.map(f => f.originalname).join(', ');
      throw new BadRequestException(
        `Files have invalid MIME type. Only PDF, PNG, or JPEG files are allowed: ${filenames}`,
      );
    }
  }
}
