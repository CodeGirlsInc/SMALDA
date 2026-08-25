import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute } from './entities/dispute.entity';
import { DisputeService } from './dispute.service';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeReason } from './entities/dispute-reason.entity';

describe('DisputeService', () => {
  let service: DisputeService;
  let disputeRepo: Repository<Dispute>;
  let classifier: DisputeReasonClassifierService;

  const mockDisputeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
  };

  const mockClassifierService = {
    classifyDispute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeService,
        {
          provide: getRepositoryToken(Dispute),
          useValue: mockDisputeRepository,
        },
        {
          provide: DisputeReasonClassifierService,
          useValue: mockClassifierService,
        },
      ],
    }).compile();

    service = module.get<DisputeService>(DisputeService);
    disputeRepo = module.get<Repository<Dispute>>(getRepositoryToken(Dispute));
    classifier = module.get<DisputeReasonClassifierService>(
      DisputeReasonClassifierService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fileDispute', () => {
    it('should create and save a dispute', async () => {
      const createDisputeDto: CreateDisputeDto = {
        documentId: 'doc-id-123',
        description: 'This is a test dispute.',
      };
      const userId = 'user-id-456';
      const reason: DisputeReason = {
        id: 'reason-id-789',
        name: 'Test Reason',
      };
      const dispute: Dispute = {
        id: 'dispute-id-1',
        documentId: createDisputeDto.documentId,
        description: createDisputeDto.description,
        filedBy: userId,
        reason: reason,
        createdAt: new Date(),
      };

      mockClassifierService.classifyDispute.mockResolvedValue(reason);
      mockDisputeRepository.create.mockReturnValue(dispute);
      mockDisputeRepository.save.mockResolvedValue(dispute);

      const result = await service.fileDispute(createDisputeDto, userId);

      expect(classifier.classifyDispute).toHaveBeenCalledWith(
        createDisputeDto.description,
      );
      expect(disputeRepo.create).toHaveBeenCalledWith({
        documentId: createDisputeDto.documentId,
        description: createDisputeDto.description,
        reason,
        filedBy: userId,
      });
      expect(disputeRepo.save).toHaveBeenCalledWith(dispute);
      expect(result).toEqual({
        id: dispute.id,
        documentId: dispute.documentId,
        description: dispute.description,
        reason: dispute.reason,
        filedBy: dispute.filedBy,
        createdAt: dispute.createdAt,
      });
    });
  });

  describe('findByUser', () => {
    it('should return disputes for a user', async () => {
      const userId = 'user-id-456';
      const disputes: Dispute[] = [
        {
          id: 'dispute-id-1',
          documentId: 'doc-1',
          description: 'desc-1',
          filedBy: userId,
          reason: null,
          createdAt: new Date(),
        },
        {
          id: 'dispute-id-2',
          documentId: 'doc-2',
          description: 'desc-2',
          filedBy: userId,
          reason: null,
          createdAt: new Date(),
        },
      ];
      const total = 2;

      mockDisputeRepository.findAndCount.mockResolvedValue([disputes, total]);

      const result = await service.findByUser(userId);

      expect(disputeRepo.findAndCount).toHaveBeenCalledWith({
        where: { filedBy: userId },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
      expect(result.data.length).toBe(2);
      expect(result.total).toBe(total);
    });
  });

  describe('findOne', () => {
    it('should return a dispute if found', async () => {
      const disputeId = 'dispute-id-1';
      const dispute: Dispute = {
        id: disputeId,
        documentId: 'doc-id-123',
        description: 'This is a test dispute.',
        filedBy: 'user-id-456',
        reason: null,
        createdAt: new Date(),
      };

      mockDisputeRepository.findOne.mockResolvedValue(dispute);

      const result = await service.findOne(disputeId, 'user-id-456');

      expect(mockDisputeRepository.findOne).toHaveBeenCalledWith({
        where: { id: disputeId },
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if dispute not found', async () => {
      const disputeId = 'non-existent-id';
      mockDisputeRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(disputeId, 'user-id-456')).rejects.toThrow(
        'Dispute non-existent-id not found',
      );
    });

    it('should throw UnauthorizedException if a user tries to access a dispute they did not file', async () => {
      const disputeId = 'dispute-id-1';
      const dispute: Dispute = {
        id: disputeId,
        documentId: 'doc-id-123',
        description: 'This is a test dispute.',
        filedBy: 'user-id-456',
        reason: null,
        createdAt: new Date(),
      };

      mockDisputeRepository.findOne.mockResolvedValue(dispute);

      await expect(
        service.findOne(disputeId, 'another-user-id'),
      ).rejects.toThrow('Unauthorized access');
    });
  });
});
