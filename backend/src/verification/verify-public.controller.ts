import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationRecord } from './entities/verification-record.entity';

@Controller('verify')
export class VerifyPublicController {
  constructor(
    @InjectRepository(VerificationRecord)
    private readonly verificationRepo: Repository<VerificationRecord>,
  ) {}

  @Get(':txHash')
  async verifyByTxHash(@Param('txHash') txHash: string) {
    const record = await this.verificationRepo.findOne({
      where: { stellarTxHash: txHash },
      relations: ['document'],
    });

    if (!record) {
      throw new NotFoundException('Verification record not found for this transaction hash');
    }

    return {
      verified: record.status === 'confirmed',
      record: {
        id: record.id,
        documentId: record.documentId,
        stellarTxHash: record.stellarTxHash,
        stellarLedger: record.stellarLedger,
        status: record.status,
        anchoredAt: record.anchoredAt,
        createdAt: record.createdAt,
      },
    };
  }
}
