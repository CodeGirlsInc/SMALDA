import { Controller, Post, Get, Param, Body, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { SharingService } from './sharing.service';
import { CreateShareInviteDto } from './dto/create-share-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';

@Controller('sharing')
@UseGuards(JwtAuthGuard)
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post('invite')
  async createInvite(@Body() dto: CreateShareInviteDto, @Req() req: Request & { user?: User }) {
    return this.sharingService.createInvite(req.user!.id, dto);
  }

  @Post('invites/:id/accept')
  async acceptInvite(@Param('id') id: string, @Req() req: Request & { user?: User }) {
    return this.sharingService.acceptInvite(id, req.user!.id);
  }

  @Post('invites/:id/revoke')
  async revokeInvite(@Param('id') id: string) {
    return this.sharingService.revokeInvite(id);
  }

  @Get('documents/:documentId/invites')
  async getInvitesForDocument(@Param('documentId') documentId: string) {
    return this.sharingService.getInvitesForDocument(documentId);
  }

  @Get('invites')
  async getMyInvites(@Req() req: Request & { user?: User }) {
    return this.sharingService.getInvitesForEmail(req.user!.email);
  }

  @Get('documents')
  async getSharedDocuments(@Req() req: Request & { user?: User }) {
    return this.sharingService.getSharedDocuments(req.user!.id);
  }
}
