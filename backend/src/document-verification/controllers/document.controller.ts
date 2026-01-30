import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { DocumentService } from '../services/document.service';
import {
  CreateDocumentDto,
  UpdateDocumentStatusDto,
  DocumentResponseDto,
} from '../dtos/document.dto';
import { DocumentStatus } from '../enums/document-status.enum';

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  async createDocument(
    createDto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.createDocument(createDto);
    return this.mapToResponseDto(document);
  }

  @Get()
  async getAllDocuments(
    status?: DocumentStatus,
  ): Promise<DocumentResponseDto[]> {
    const documents = await this.documentService.getAllDocuments(status);
    return documents.map((doc) => this.mapToResponseDto(doc));
  }

  @Get(':id')
  async getDocument(id: string): Promise<DocumentResponseDto> {
    const document = await this.documentService.getDocument(id);
    return this.mapToResponseDto(document);
  }

  @Put(':id/status')
  async updateDocumentStatus(
    id: string,
    updateDto: UpdateDocumentStatusDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.updateDocumentStatus(
      id,
      updateDto,
    );
    return this.mapToResponseDto(document);
  }

  @Get(':id/transitions')
  async getDocumentTransitions(
    id: string,
  ): Promise<DocumentStatus[]> {
    return this.documentService.getDocumentTransitions(id);
  }

  private mapToResponseDto(document: any): DocumentResponseDto {
    return {
      id: document.id,
      title: document.title,
      description: document.description,
      submittedBy: document.submittedBy,
      reviewedBy: document.reviewedBy,
      status: document.status,
      rejectionReason: document.rejectionReason,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
