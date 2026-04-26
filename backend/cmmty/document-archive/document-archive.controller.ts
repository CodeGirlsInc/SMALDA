import { Controller, Post, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DocumentArchiveService } from './document-archive.service';
import { ArchiveResponseDto } from './dto/archive-response.dto';
import { ArchivedDocumentsQueryDto } from './dto/archived-documents-query.dto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentArchiveController {
  constructor(private readonly documentArchiveService: DocumentArchiveService) {}

  @Post(':id/archive')
  async archive(@Param('id') id: string): Promise<ArchiveResponseDto> {
    return this.documentArchiveService.archive(id);
  }

  @Post(':id/unarchive')
  async unarchive(@Param('id') id: string): Promise<ArchiveResponseDto> {
    return this.documentArchiveService.unarchive(id);
  }

  @Get('archived')
  async getArchivedDocuments(@Query() query: ArchivedDocumentsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    return this.documentArchiveService.getArchivedDocuments(page, limit);
  }
}
