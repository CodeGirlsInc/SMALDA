import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DocumentNotesService } from './document-notes.service';
import { DocumentNote } from './entities/document-note.entity';
import { CreateDocumentNoteDto } from './dto/create-document-note.dto';
import { DocumentsService } from '../../src/documents/documents.service';
import { Document } from '../../src/documents/entities/document.entity';

describe('DocumentNotesService', () => {
  let service: DocumentNotesService;
  let documentNoteRepository: Repository<DocumentNote>;
  let documentsService: DocumentsService;

  const mockDocument: Document = {
    id: 'document-id-123',
    ownerId: 'user-id-123',
    title: 'Test Document',
    filePath: '/path/to/file',
    fileHash: 'hash123',
    fileSize: 1000,
    mimeType: 'application/pdf',
    status: 'verified' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNote: DocumentNote = {
    id: 'note-id-123',
    content: 'This is a test note',
    documentId: 'document-id-123',
    authorId: 'user-id-123',
    createdAt: new Date(),
    document: mockDocument,
    author: {} as any,
  };

  const mockDocumentsService = {
    findById: jest.fn(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentNotesService,
        {
          provide: getRepositoryToken(DocumentNote),
          useValue: mockRepository,
        },
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
      ],
    }).compile();

    service = module.get<DocumentNotesService>(DocumentNotesService);
    documentNoteRepository = module.get<Repository<DocumentNote>>(getRepositoryToken(DocumentNote));
    documentsService = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a note for owned document', async () => {
      const dto: CreateDocumentNoteDto = { content: 'Test note' };
      const documentId = 'document-id-123';
      const authorId = 'user-id-123';

      mockDocumentsService.findById.mockResolvedValue(mockDocument);
      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(documentId, authorId, dto);

      expect(mockDocumentsService.findById).toHaveBeenCalledWith(documentId);
      expect(mockRepository.create).toHaveBeenCalledWith({
        content: dto.content,
        documentId,
        authorId,
      });
      expect(result).toEqual(mockNote);
    });

    it('should throw NotFoundException for non-existent document', async () => {
      const dto: CreateDocumentNoteDto = { content: 'Test note' };
      const documentId = 'non-existent';
      const authorId = 'user-id-123';

      mockDocumentsService.findById.mockResolvedValue(null);

      await expect(service.create(documentId, authorId, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owned document', async () => {
      const dto: CreateDocumentNoteDto = { content: 'Test note' };
      const documentId = 'document-id-123';
      const authorId = 'different-user-id';

      const otherDocument = { ...mockDocument, ownerId: 'other-user' };
      mockDocumentsService.findById.mockResolvedValue(otherDocument);

      await expect(service.create(documentId, authorId, dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByDocumentId', () => {
    it('should return notes for owned document', async () => {
      const documentId = 'document-id-123';
      const authorId = 'user-id-123';
      const notes = [mockNote];

      mockDocumentsService.findById.mockResolvedValue(mockDocument);
      mockRepository.find.mockResolvedValue(notes);

      const result = await service.findByDocumentId(documentId, authorId);

      expect(mockDocumentsService.findById).toHaveBeenCalledWith(documentId);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { documentId },
        order: { createdAt: 'DESC' },
        relations: ['author'],
      });
      expect(result).toEqual(notes);
    });

    it('should throw NotFoundException for non-existent document', async () => {
      const documentId = 'non-existent';
      const authorId = 'user-id-123';

      mockDocumentsService.findById.mockResolvedValue(null);

      await expect(service.findByDocumentId(documentId, authorId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owned document', async () => {
      const documentId = 'document-id-123';
      const authorId = 'different-user-id';

      const otherDocument = { ...mockDocument, ownerId: 'other-user' };
      mockDocumentsService.findById.mockResolvedValue(otherDocument);

      await expect(service.findByDocumentId(documentId, authorId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should delete note for owned document', async () => {
      const noteId = 'note-id-123';
      const authorId = 'user-id-123';

      mockRepository.findOne.mockResolvedValue(mockNote);
      mockRepository.delete.mockResolvedValue(undefined);

      await expect(service.delete(noteId, authorId)).resolves.toBeUndefined();

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: noteId },
        relations: ['document'],
      });
      expect(mockRepository.delete).toHaveBeenCalledWith(noteId);
    });

    it('should throw NotFoundException for non-existent note', async () => {
      const noteId = 'non-existent';
      const authorId = 'user-id-123';

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(noteId, authorId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for note on non-owned document', async () => {
      const noteId = 'note-id-123';
      const authorId = 'different-user-id';

      const noteWithOtherOwner = {
        ...mockNote,
        document: { ...mockDocument, ownerId: 'other-user' },
      };
      mockRepository.findOne.mockResolvedValue(noteWithOtherOwner);

      await expect(service.delete(noteId, authorId)).rejects.toThrow(ForbiddenException);
    });
  });
});