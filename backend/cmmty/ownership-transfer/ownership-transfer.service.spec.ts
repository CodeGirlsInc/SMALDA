import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { OwnershipTransferService } from './ownership-transfer.service';
import { OwnershipTransfer } from './entities/ownership-transfer.entity';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';

describe('OwnershipTransferService', () => {
  let service: OwnershipTransferService;
  let documentRepository: Repository<Document>;
  let userRepository: Repository<User>;
  let ownershipTransferRepository: Repository<OwnershipTransfer>;

  const mockDocument = {
    id: 'doc-1',
    ownerId: 'user-1',
    title: 'Test Document',
  } as Document;

  const mockUser = {
    id: 'user-2',
    email: 'newowner@example.com',
    fullName: 'New Owner',
  } as User;

  const mockTransferDto: TransferOwnershipDto = {
    toUserEmail: 'newowner@example.com',
  };

  const mockOwnershipTransfer = {
    id: 'transfer-1',
    documentId: 'doc-1',
    fromUserId: 'user-1',
    toUserId: 'user-2',
    transferredAt: new Date(),
  } as OwnershipTransfer;

  const mockDocumentRepository = {
    findOne: jest.fn(),
    manager: {
      transaction: jest.fn((callback) => callback(mockEntityManager)),
    },
    save: jest.fn(),
  };

  const mockEntityManager = {
    save: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockOwnershipTransferRepository = {
    create: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipTransferService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(OwnershipTransfer),
          useValue: mockOwnershipTransferRepository,
        },
      ],
    }).compile();

    service = module.get<OwnershipTransferService>(OwnershipTransferService);
    documentRepository = module.get<Repository<Document>>(getRepositoryToken(Document));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    ownershipTransferRepository = module.get<Repository<OwnershipTransfer>>(
      getRepositoryToken(OwnershipTransfer),
    );

    jest.clearAllMocks();
  });

  describe('transferOwnership', () => {
    it('should successfully transfer ownership', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockOwnershipTransferRepository.create.mockReturnValue(mockOwnershipTransfer);
      mockEntityManager.save.mockResolvedValue({});

      const result = await service.transferOwnership('doc-1', 'user-1', mockTransferDto);

      expect(result.message).toBe('Ownership transferred successfully');
      expect(result.transfer).toEqual(mockOwnershipTransfer);
      expect(mockDocumentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        relations: ['owner'],
      });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'newowner@example.com' },
      });
    });

    it('should throw NotFoundException when document does not exist', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.transferOwnership('non-existent', 'user-1', mockTransferDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      mockDocumentRepository.findOne.mockResolvedValue({
        ...mockDocument,
        ownerId: 'user-999',
      });

      await expect(
        service.transferOwnership('doc-1', 'user-1', mockTransferDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target user does not exist', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.transferOwnership('doc-1', 'user-1', mockTransferDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when transferring to oneself', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        id: 'user-1',
      });

      await expect(
        service.transferOwnership('doc-1', 'user-1', mockTransferDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTransferHistory', () => {
    it('should return transfer history for a document', async () => {
      const mockTransfers = [mockOwnershipTransfer];
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);
      mockOwnershipTransferRepository.find.mockResolvedValue(mockTransfers);

      const result = await service.getTransferHistory('doc-1');

      expect(result).toEqual(mockTransfers);
      expect(mockOwnershipTransferRepository.find).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
        relations: ['fromUser', 'toUser'],
        order: { transferredAt: 'DESC' },
      });
    });

    it('should throw NotFoundException when document does not exist', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(service.getTransferHistory('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
