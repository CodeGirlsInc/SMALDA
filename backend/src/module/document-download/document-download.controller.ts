import {
  Controller, Get, Param, Req, Res, UseGuards,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

@Controller('module/documents')
@UseGuards(JwtAuthGuard)
export class DocumentDownloadController {
  constructor(
    @InjectRepository(Document)
    private readonly docs: Repository<Document>,
  ) {}

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Req() req: { user: User },
    @Res() res: Response,
  ) {
    const doc = await this.docs.findOneBy({ id });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerId !== req.user.id) throw new ForbiddenException();
    if (!existsSync(doc.filePath)) throw new NotFoundException('File not found on disk');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.title}"`);
    createReadStream(doc.filePath).pipe(res);
  }
}