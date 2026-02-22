import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { BatchJob, BatchDocumentResult } from './entities/batch-job.entity';
import { BatchJobStatus } from './enums/batch-job-status.enum';
import { DocumentUploadService } from '../document-upload/document-upload.service';

const MAX_FILES_PER_BATCH = 20;

@Injectable()
export class BatchSubmissionService {
  constructor(
    @InjectRepository(BatchJob)
    private readonly batchJobRepository: Repository<BatchJob>,
    private readonly documentUploadService: DocumentUploadService,
  ) {}

  /**
   * Persists all uploaded files, creates a batch job record, and processes
   * the batch synchronously before returning the completed job.
   */
  async createBatch(files: Express.Multer.File[]): Promise<BatchJob> {
    if (files.length > MAX_FILES_PER_BATCH) {
      throw new BadRequestException(
        `A batch may contain at most ${MAX_FILES_PER_BATCH} files. Received ${files.length}.`,
      );
    }

    const savedDocuments = await Promise.all(
      files.map((file) => this.documentUploadService.saveUpload(file)),
    );

    const initialResults: BatchDocumentResult[] = savedDocuments.map((doc) => ({
      documentId: doc.id,
      originalName: doc.originalName,
      status: 'pending',
    }));

    const batchJob = this.batchJobRepository.create({
      totalDocuments: files.length,
      status: BatchJobStatus.PENDING,
      results: initialResults,
    });

    const saved = await this.batchJobRepository.save(batchJob);

    await this.processBatch(saved.id);

    return this.getBatchStatus(saved.id);
  }

  /**
   * Returns the current status and per-document results for the given batch job.
   */
  async getBatchStatus(batchId: string): Promise<BatchJob> {
    const batchJob = await this.batchJobRepository.findOne({
      where: { id: batchId },
    });

    if (!batchJob) {
      throw new NotFoundException(`Batch job with ID "${batchId}" not found`);
    }

    return batchJob;
  }

  /**
   * Iterates through all documents in the batch, computes their SHA-256 hash,
   * and updates the batch job record with per-document results.
   * Runs synchronously — no external queue is used.
   */
  async processBatch(batchId: string): Promise<void> {
    const batchJob = await this.batchJobRepository.findOne({
      where: { id: batchId },
    });

    if (!batchJob) {
      throw new NotFoundException(`Batch job with ID "${batchId}" not found`);
    }

    batchJob.status = BatchJobStatus.PROCESSING;
    await this.batchJobRepository.save(batchJob);

    let processedCount = 0;
    let failedCount = 0;

    const updatedResults: BatchDocumentResult[] = await Promise.all(
      batchJob.results.map(async (result) => {
        try {
          const document = await this.documentUploadService.findById(
            result.documentId,
          );
          const hash = await this.computeFileHash(document.storagePath);
          processedCount++;
          return { ...result, status: 'success' as const, hash };
        } catch (err: unknown) {
          failedCount++;
          const message =
            err instanceof Error ? err.message : 'Unknown processing error';
          return { ...result, status: 'failed' as const, error: message };
        }
      }),
    );

    batchJob.results = updatedResults;
    batchJob.processedCount = processedCount;
    batchJob.failedCount = failedCount;
    batchJob.completedAt = new Date();

    if (failedCount === 0) {
      batchJob.status = BatchJobStatus.COMPLETED;
    } else if (processedCount === 0) {
      batchJob.status = BatchJobStatus.FAILED;
    } else {
      batchJob.status = BatchJobStatus.PARTIALLY_FAILED;
    }

    await this.batchJobRepository.save(batchJob);
  }

  private computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      stream.on('data', (chunk: Buffer) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }
}
