import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';
import { OwnershipTransfer } from './entities/ownership-transfer.entity';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';

@Injectable()
export class OwnershipTransferService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(OwnershipTransfer)
    private readonly ownershipTransferRepository: Repository<OwnershipTransfer>,
  ) {}

  async transferOwnership(
    documentId: string,
    currentUserId: string,
    dto: TransferOwnershipDto,
  ): Promise<{ message: string; transfer: OwnershipTransfer }> {
    // Find the document
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['owner'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check if current user is the owner
    if (document.ownerId !== currentUserId) {
      throw new ForbiddenException('Only the document owner can transfer ownership');
    }

    // Find the target user by email
    const targetUser = await this.userRepository.findOne({
      where: { email: dto.toUserEmail },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Prevent transferring to oneself
    if (targetUser.id === currentUserId) {
      throw new BadRequestException('Cannot transfer ownership to yourself');
    }

    // Create the ownership transfer record
    const transfer = this.ownershipTransferRepository.create({
      documentId,
      fromUserId: currentUserId,
      toUserId: targetUser.id,
    });

    // Update document ownership
    document.ownerId = targetUser.id;

    // Save both in a transaction
    await this.documentRepository.manager.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(OwnershipTransfer, transfer);
      await transactionalEntityManager.save(Document, document);
    });

    return {
      message: 'Ownership transferred successfully',
      transfer,
    };
  }

  async getTransferHistory(documentId: string): Promise<OwnershipTransfer[]> {
    // Verify document exists
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Get transfer history
    const transfers = await this.ownershipTransferRepository.find({
      where: { documentId },
      relations: ['fromUser', 'toUser'],
      order: { transferredAt: 'DESC' },
    });

    return transfers;
  }
}
