import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { CreateDocumentDto, UpdateDocumentStatusDto } from '../dtos/document.dto';
import { DocumentStatus } from '../enums/document-status.enum';
import { WorkflowStateMachine } from './workflow-state-machine';

@Injectable()
export class DocumentService {
  private readonly stateMachine: WorkflowStateMachine;
  private readonly documentRepository: Repository<Document>;

  constructor(documentRepository: Repository<Document>) {
    this.stateMachine = new WorkflowStateMachine();
    this.documentRepository = documentRepository;
  }

  /**
   * Create a new document (initial state: SUBMITTED)
   */
  async createDocument(createDto: CreateDocumentDto): Promise<Document> {
    const document = this.documentRepository.create({
      ...createDto,
      status: DocumentStatus.SUBMITTED,
    });
    return this.documentRepository.save(document);
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<Document> {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    return document;
  }

  /**
   * Get all documents with optional filtering by status
   */
  async getAllDocuments(status?: DocumentStatus): Promise<Document[]> {
    const query = this.documentRepository.createQueryBuilder('doc');
    if (status) {
      query.where('doc.status = :status', { status });
    }
    return query.orderBy('doc.createdAt', 'DESC').getMany();
  }

  /**
   * Update document status with state machine validation
   */
  async updateDocumentStatus(
    id: string,
    updateDto: UpdateDocumentStatusDto,
  ): Promise<Document> {
    const document = await this.getDocument(id);

    // Validate state transition
    this.stateMachine.validateTransition(document.status, updateDto.status);

    // Update document
    document.status = updateDto.status;
    document.reviewedBy = updateDto.reviewedBy;

    if (updateDto.status === DocumentStatus.REJECTED) {
      document.rejectionReason = updateDto.rejectionReason;
    }

    return this.documentRepository.save(document);
  }

  /**
   * Get allowed transitions for a document
   */
  async getDocumentTransitions(id: string): Promise<DocumentStatus[]> {
    const document = await this.getDocument(id);
    return this.stateMachine.getAllowedTransitions(document.status);
  }
}
