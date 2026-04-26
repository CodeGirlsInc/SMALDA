import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { DocumentNotesService } from './document-notes.service';
import { CreateDocumentNoteDto } from './dto/create-document-note.dto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User } from '../../src/users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('cmmty/documents')
@UseGuards(JwtAuthGuard)
export class DocumentNotesController {
  constructor(private readonly documentNotesService: DocumentNotesService) {}

  @Post(':id/notes')
  async createNote(
    @Param('id') documentId: string,
    @Body() dto: CreateDocumentNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    return this.documentNotesService.create(documentId, userId, dto);
  }

  @Get(':id/notes')
  async getNotes(
    @Param('id') documentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    return this.documentNotesService.findByDocumentId(documentId, userId);
  }

  @Delete(':id/notes/:noteId')
  async deleteNote(
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    await this.documentNotesService.delete(noteId, userId);
    return { message: 'Note deleted successfully' };
  }
}