import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentNote } from './entities/document-note.entity';
import { CreateDocumentNoteDto } from './dto/create-document-note.dto';
import { DocumentsService } from '../../src/documents/documents.service';

@Injectable()
export class DocumentNotesService {
  constructor(
    @InjectRepository(DocumentNote)
    private readonly documentNoteRepository: Repository<DocumentNote>,
    private readonly documentsService: DocumentsService,
  ) {}

  async create(
    documentId: string,
    authorId: string,
    dto: CreateDocumentNoteDto,
  ): Promise<DocumentNote> {
    // Verify document exists and user owns it
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.ownerId !== authorId) {
      throw new ForbiddenException('You can only add notes to your own documents');
    }

    const note = this.documentNoteRepository.create({
      content: dto.content,
      documentId,
      authorId,
    });

    return this.documentNoteRepository.save(note);
  }

  async findByDocumentId(documentId: string, authorId: string): Promise<DocumentNote[]> {
    // Verify document exists and user owns it
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.ownerId !== authorId) {
      throw new ForbiddenException('You can only view notes for your own documents');
    }

    return this.documentNoteRepository.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
      relations: ['author'],
    });
  }

  async delete(noteId: string, authorId: string): Promise<void> {
    const note = await this.documentNoteRepository.findOne({
      where: { id: noteId },
      relations: ['document'],
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Verify the note belongs to the user (through document ownership)
    if (note.document.ownerId !== authorId) {
      throw new ForbiddenException('You can only delete notes for your own documents');
    }

    await this.documentNoteRepository.delete(noteId);
  }
}