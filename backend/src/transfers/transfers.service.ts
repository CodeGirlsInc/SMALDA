import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import { DocumentsService } from '../documents/documents.service';
import { StellarService } from '../stellar/stellar.service';
import { UsersService } from '../users/users.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { Transfer } from './entities/transfer.entity';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
    private readonly stellarService: StellarService,
  ) {}

  async create(dto: CreateTransferDto): Promise<Transfer> {
    // Validate document exists
    const document = await this.documentsService.findById(dto.documentId);
    if (!document) {
      throw new NotFoundException(`Document ${dto.documentId} not found`);
    }

    // Validate seller and buyer exist
    const [seller, buyer] = await Promise.all([
      this.usersService.findById(dto.fromUserId),
      this.usersService.findById(dto.toUserId),
    ]);

    if (!seller) {
      throw new NotFoundException(`Seller user ${dto.fromUserId} not found`);
    }
    if (!buyer) {
      throw new NotFoundException(`Buyer user ${dto.toUserId} not found`);
    }

    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Seller and buyer must be different users');
    }

    // Build a deterministic transfer payload hash to anchor on Stellar
    const transferredAt = dto.transferredAt ? new Date(dto.transferredAt) : new Date();
    const payload = JSON.stringify({
      documentId: dto.documentId,
      fromUserId: dto.fromUserId,
      toUserId: dto.toUserId,
      transferredAt: transferredAt.toISOString(),
    });
    const transferHash = createHash('sha256').update(payload).digest('hex');

    // Anchor the transfer event on Stellar
    let stellarTxHash: string | undefined;
    try {
      const result = await this.stellarService.anchorHash(transferHash);
      stellarTxHash = result.txHash;
    } catch (error) {
      this.logger.error('Failed to anchor transfer on Stellar', error);
      // Re-throw so the whole operation fails atomically
      throw error;
    }

    // Persist the transfer record
    const transfer = this.transferRepository.create({
      documentId: dto.documentId,
      fromUserId: dto.fromUserId,
      toUserId: dto.toUserId,
      stellarTxHash,
      transferredAt,
      notes: dto.notes,
    });

    return this.transferRepository.save(transfer);
  }

  findByDocument(documentId: string): Promise<Transfer[]> {
    return this.transferRepository.find({
      where: { documentId },
      order: { transferredAt: 'ASC' },
      relations: ['fromUser', 'toUser'],
    });
  }
}
