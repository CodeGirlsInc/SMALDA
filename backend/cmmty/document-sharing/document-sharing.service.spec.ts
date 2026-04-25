import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';
import { DocumentShare } from './document-share.entity';
import { DocumentSharingService } from './document-sharing.service';

describe('DocumentSharingService', () => {
  let service: DocumentSharingService;

  const mockDocumentShareRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    delete: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockDocumentRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentSharingService,
        {
          provide: getRepositoryToken(DocumentShare),
          useValue: mockDocumentShareRepository,
        },
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<DocumentSharingService>(DocumentSharingService);
  });

  it('should share a document with another user', async () => {
    mockDocumentRepository.findOne.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'owner-1',
    });
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-2',
      email: 'user2@example.com',
    });
    mockDocumentShareRepository.findOne.mockResolvedValue(null);
    mockDocumentShareRepository.save.mockResolvedValue({
      id: 'share-1',
      documentId: 'doc-1',
      sharedByUserId: 'owner-1',
      sharedWithUserId: 'user-2',
    });

    const result = await service.shareDocument('doc-1', 'owner-1', {
      email: 'user2@example.com',
    });

    expect(result.id).toBe('share-1');
    expect(mockDocumentShareRepository.save).toHaveBeenCalled();
  });

  it('should revoke an existing share', async () => {
    mockDocumentShareRepository.delete.mockResolvedValue({ affected: 1 });

    const result = await service.revokeShare('doc-1', 'owner-1', 'user-2');

    expect(result.message).toBe('Share revoked successfully');
    expect(mockDocumentShareRepository.delete).toHaveBeenCalledWith({
      documentId: 'doc-1',
      sharedByUserId: 'owner-1',
      sharedWithUserId: 'user-2',
    });
  });
});
