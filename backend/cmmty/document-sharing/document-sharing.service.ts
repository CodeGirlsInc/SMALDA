import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';
import { DocumentShare } from './document-share.entity';
import { ShareDocumentDto } from './dto/share-document.dto';
import { SharedDocumentsQueryDto } from './dto/shared-documents-query.dto';

@Injectable()
export class DocumentSharingService {
  constructor(
    @InjectRepository(DocumentShare)
    private readonly documentShareRepository: Repository<DocumentShare>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async shareDocument(
    documentId: string,
    sharedByUserId: string,
    dto: ShareDocumentDto,
  ): Promise<DocumentShare> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.ownerId !== sharedByUserId) {
      throw new ForbiddenException('You can only share documents you own');
    }

    const targetUser = await this.userRepository.findOne({ where: { email: dto.email } });
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    if (targetUser.id === sharedByUserId) {
      throw new BadRequestException('You cannot share a document with yourself');
    }

    const existingShare = await this.documentShareRepository.findOne({
      where: {
        documentId,
        sharedByUserId,
        sharedWithUserId: targetUser.id,
      },
    });

    if (existingShare) {
      return existingShare;
    }

    const share = this.documentShareRepository.create({
      documentId,
      sharedByUserId,
      sharedWithUserId: targetUser.id,
    });

    return this.documentShareRepository.save(share);
  }

  async revokeShare(
    documentId: string,
    sharedByUserId: string,
    sharedWithUserId: string,
  ): Promise<{ message: string }> {
    const result = await this.documentShareRepository.delete({
      documentId,
      sharedByUserId,
      sharedWithUserId,
    });

    if (!result.affected) {
      throw new NotFoundException('Share not found');
    }

    return { message: 'Share revoked successfully' };
  }

  async listSharedWithMe(userId: string, dto: SharedDocumentsQueryDto) {
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    const [shares, total] = await this.documentShareRepository.findAndCount({
      where: { sharedWithUserId: userId },
      relations: ['document'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: shares.map((share) => ({
        id: share.id,
        documentId: share.documentId,
        sharedByUserId: share.sharedByUserId,
        createdAt: share.createdAt,
        document: share.document
          ? {
              id: share.document.id,
              ownerId: share.document.ownerId,
              title: share.document.title,
              status: share.document.status,
            }
          : null,
      })),
      total,
      page,
      limit,
    };
  }
}
