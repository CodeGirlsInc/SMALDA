import { Controller, Get, Param, Delete, UseGuards, Post, Body, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DocumentsService } from './documents.service';
import { VerificationService } from '../verification/verification.service';
import { UserRole } from '../users/entities/user.entity';
import { UpdateDocumentStatusDto } from './dto/document-request-response.dto';

@Controller('admin/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminDocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly verificationService: VerificationService,
  ) {}

  @Get('deleted')
  async getDeletedDocuments() {
    const deletedDocuments = await this.documentsService.findByOwnerIncludingDeleted('admin');
    return deletedDocuments.filter(doc => doc.deletedAt);
  }

  @Get(':id/deleted-verification-records')
  async getDeletedVerificationRecords(@Param('id') id: string) {
    return this.verificationService.findByDocumentIncludingDeleted(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateDocumentStatusDto) {
    return this.documentsService.updateStatus(id, dto.status);
  }

  @Post(':id/restore')
  async restoreDocument(@Param('id') id: string) {
    await this.documentsService.restore(id);
    return { message: 'Document restored successfully' };
  }

  @Delete(':id/hard-delete')
  async hardDeleteDocument(@Param('id') id: string) {
    await this.verificationService.hardDeleteByDocument(id);
    await this.documentsService.hardDelete(id);
    return { message: 'Document permanently deleted' };
  }
}
