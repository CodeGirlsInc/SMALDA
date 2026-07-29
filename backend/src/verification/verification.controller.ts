import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { DocumentsService } from '../documents/documents.service';
import { VerificationService } from './verification.service';

// Stricter rate limiting for public endpoint (10 requests per minute)
@Throttle({ default: { ttl: 60000, limit: 10 } })
@Controller('verify')
export class VerificationController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly verificationService: VerificationService,
  ) {}

  @Get(':hash')
  async verifyByHash(@Param('hash') hash: string) {
    // Validate hash format: 64-character hex string (SHA-256)
    if (!hash || !/^[a-fA-F0-9]{64}$/.test(hash)) {
      throw new BadRequestException(
        'Invalid hash format. Expected 64-character hexadecimal SHA-256 hash',
      );
    }

    // Look up document by file hash
    const document = await this.documentsService.findByFileHash(hash);
    if (!document) {
      return {
        verified: false,
        message: 'Document not found',
      };
    }

    // Get the latest verification record
    const record = await this.verificationService.findLatestByDocument(
      document.id,
    );

    if (!record) {
      return {
        verified: false,
        message: 'Document has not been verified on Stellar',
      };
    }

    // Return only verification status - no document metadata
    return {
      verified: true,
      stellarTxHash: record.stellarTxHash,
      stellarLedger: record.stellarLedger,
      anchoredAt: record.anchoredAt,
    };
  }
}
