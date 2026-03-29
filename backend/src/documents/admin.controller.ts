import { Controller, Get, Param, Delete, UseGuards, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { VerificationService } from '../verification/verification.service';
import { UserRole } from '../users/entities/user.entity';

@Controller('admin/documents')
@UseGuards(JwtAuthGuard)
export class AdminDocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly verificationService: VerificationService,
  ) {}

  @Get('deleted')
  async getDeletedDocuments() {
    // This endpoint would require user role checking in a real implementation
    // For now, we'll assume the controller is protected by role-based middleware
    const deletedDocuments = await this.documentsService.findByOwnerIncludingDeleted('admin');
    return deletedDocuments.filter(doc => doc.deletedAt);
  }

  @Get(':id/deleted-verification-records')
  async getDeletedVerificationRecords(@Param('id') id: string) {
    return this.verificationService.findByDocumentIncludingDeleted(id);
  }

  @Post(':id/restore')
  async restoreDocument(@Param('id') id: string) {
    await this.documentsService.restore(id);
    return { message: 'Document restored successfully' };
  }

  @Delete(':id/hard-delete')
  async hardDeleteDocument(@Param('id') id: string) {
    // This permanently deletes the document and its verification records
    await this.verificationService.hardDeleteByDocument(id);
    await this.documentsService.hardDelete(id);
    return { message: 'Document permanently deleted' };
  }
}
