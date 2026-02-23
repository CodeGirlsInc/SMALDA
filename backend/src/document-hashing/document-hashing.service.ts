import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { UploadedDocument } from './entities/uploaded-document.entity';

@Injectable()
export class DocumentHashingService {
  constructor(
    @InjectRepository(UploadedDocument)
    private readonly documentRepository: Repository<UploadedDocument>,
  ) {}

  /**
   * Reads the file at `filePath` as a stream and returns its hex-encoded SHA-256 hash.
   * Streaming avoids loading the entire file into memory, making it safe for large documents.
   */
  computeHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const fileStream = fs.createReadStream(filePath);

      fileStream.on('error', reject);
      fileStream.on('data', (chunk: Buffer) => hash.update(chunk));
      fileStream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  /**
   * Computes a hex-encoded SHA-256 hash from an in-memory buffer.
   * Useful when the file bytes are already available (e.g. after Multer upload).
   */
  computeHashFromBuffer(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Recomputes the hash of the file at `filePath` and compares it against `expectedHash`.
   * Returns true only when the hashes match exactly (constant-time comparison via timingSafeEqual).
   */
  async verifyHash(filePath: string, expectedHash: string): Promise<boolean> {
    const actualHash = await this.computeHash(filePath);

    // Use timingSafeEqual to prevent timing-based side-channel attacks
    const actual = Buffer.from(actualHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    if (actual.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(actual, expected);
  }

  /**
   * Internal method: looks up the document by ID, computes the SHA-256 hash of its file,
   * persists the result back to the `sha256Hash` column, and returns the updated record.
   *
   * Intended to be called by other services (e.g. after a file upload completes)
   * rather than exposed directly via an HTTP endpoint.
   */
  async hashAndStore(documentId: string): Promise<UploadedDocument> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(
        `UploadedDocument with ID ${documentId} not found`,
      );
    }

    document.sha256Hash = await this.computeHash(document.filePath);

    return this.documentRepository.save(document);
  }
}
