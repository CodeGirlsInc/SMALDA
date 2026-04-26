import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { DocumentSharingService } from './document-sharing.service';
import { ShareDocumentDto } from './dto/share-document.dto';
import { SharedDocumentsQueryDto } from './dto/shared-documents-query.dto';

@Controller('cmmty/documents')
@UseGuards(JwtAuthGuard)
export class DocumentSharingController {
  constructor(private readonly documentSharingService: DocumentSharingService) {}

  @Post(':id/share')
  shareDocument(@Req() req: any, @Param('id') id: string, @Body() dto: ShareDocumentDto) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found in request');
    }

    return this.documentSharingService.shareDocument(id, userId, dto);
  }

  @Delete(':id/share/:userId')
  revokeShare(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      throw new UnauthorizedException('User not found in request');
    }

    return this.documentSharingService.revokeShare(id, currentUserId, userId);
  }

  @Get('shared-with-me')
  listSharedWithMe(@Req() req: any, @Query() dto: SharedDocumentsQueryDto) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found in request');
    }

    return this.documentSharingService.listSharedWithMe(userId, dto);
  }
}
