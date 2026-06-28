import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShareInvite, ShareInviteStatus } from './entities/share-invite.entity';
import { CreateShareInviteDto } from './dto/create-share-invite.dto';
import { DocumentsService } from '../documents/documents.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class SharingService {
  constructor(
    @InjectRepository(ShareInvite)
    private readonly shareInviteRepository: Repository<ShareInvite>,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
  ) {}

  async createInvite(invitedByUserId: string, dto: CreateShareInviteDto): Promise<ShareInvite> {
    const document = await this.documentsService.findById(dto.documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.ownerId !== invitedByUserId) {
      throw new ForbiddenException('Only the document owner can send invites');
    }

    const existing = await this.shareInviteRepository.findOne({
      where: {
        documentId: dto.documentId,
        invitedEmail: dto.invitedEmail,
        status: ShareInviteStatus.PENDING,
      },
    });

    if (existing) {
      throw new ConflictException('An active invite already exists for this email on this document');
    }

    const invite = this.shareInviteRepository.create({
      documentId: dto.documentId,
      invitedEmail: dto.invitedEmail,
      invitedById: invitedByUserId,
      status: ShareInviteStatus.PENDING,
    });

    return this.shareInviteRepository.save(invite);
  }

  async acceptInvite(inviteId: string, userId: string): Promise<ShareInvite> {
    const invite = await this.shareInviteRepository.findOne({ where: { id: inviteId } });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== ShareInviteStatus.PENDING) {
      throw new ConflictException('Invite is no longer pending');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email !== invite.invitedEmail) {
      throw new ForbiddenException('This invite was not sent to your email');
    }

    invite.status = ShareInviteStatus.ACCEPTED;
    invite.acceptedByUserId = userId;
    return this.shareInviteRepository.save(invite);
  }

  async revokeInvite(inviteId: string): Promise<ShareInvite> {
    const invite = await this.shareInviteRepository.findOne({ where: { id: inviteId } });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    invite.status = ShareInviteStatus.REVOKED;
    return this.shareInviteRepository.save(invite);
  }

  async getInvitesForDocument(documentId: string): Promise<ShareInvite[]> {
    return this.shareInviteRepository.find({ where: { documentId } });
  }

  async getInvitesForEmail(email: string): Promise<ShareInvite[]> {
    return this.shareInviteRepository.find({
      where: { invitedEmail: email, status: ShareInviteStatus.PENDING },
    });
  }

  async getSharedDocuments(userId: string): Promise<any[]> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const invites = await this.shareInviteRepository.find({
      where: { invitedEmail: user.email, status: ShareInviteStatus.ACCEPTED },
      relations: ['documentRef'],
    });

    return invites.filter((invite) => invite.documentRef).map((invite) => invite.documentRef);
  }

  async canAccess(userId: string, documentId: string): Promise<boolean> {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      return false;
    }

    if (document.ownerId === userId) {
      return true;
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      return false;
    }

    const acceptedInvite = await this.shareInviteRepository.findOne({
      where: {
        documentId,
        invitedEmail: user.email,
        status: ShareInviteStatus.ACCEPTED,
      },
    });

    return !!acceptedInvite;
  }
}
