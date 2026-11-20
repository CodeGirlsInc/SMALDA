import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { DisputeReason } from './entities/dispute-reason.entity';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

function makeDispute(overrides: Partial<Dispute> = {}): Dispute {
  return {
    id: 'dispute-1',
    documentId: 'doc-1',
    description: 'Invalid signature',
    reason: null,
    filedBy: 'user-1',
    status: DisputeStatus.OPEN,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Dispute;
}

describe('DisputeService', () => {
  let service: DisputeService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock;
  };
  let classifier: { classifyDispute: jest.Mock };
  let accessLogs: { logDocumentAccess: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[makeDispute()], 1]),
    };
    classifier = { classifyDispute: jest.fn().mockResolvedValue(null) };
    accessLogs = { logDocumentAccess: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeService,
        { provide: getRepositoryToken(Dispute), useValue: repo },
        { provide: DisputeReasonClassifierService, useValue: classifier },
        { provide: AccessLogsService, useValue: accessLogs },
      ],
    }).compile();

    service = module.get<DisputeService>(DisputeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fileDispute', () => {
    const dto: CreateDisputeDto = {
      documentId: 'doc-id-123',
      description: 'This is a test dispute.',
    };

    it('should create and save a dispute', async () => {
      const reason: DisputeReason = { id: 'reason-id-789', name: 'Test Reason' };
      const dispute = makeDispute({
        id: 'dispute-id-1',
        documentId: dto.documentId,
        description: dto.description,
        reason,
        filedBy: 'user-id-456',
      });
      classifier.classifyDispute.mockResolvedValue(reason);
      repo.create.mockReturnValue(dispute);
      repo.save.mockResolvedValue(dispute);

      const result = await service.fileDispute(dto, 'user-id-456');

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentId: dto.documentId,
            filedBy: 'user-id-456',
          }),
        }),
      );
      expect(classifier.classifyDispute).toHaveBeenCalledWith(dto.description);
      expect(repo.create).toHaveBeenCalledWith({
        documentId: dto.documentId,
        description: dto.description,
        reason,
        filedBy: 'user-id-456',
        status: DisputeStatus.OPEN,
      });
      expect(repo.save).toHaveBeenCalledWith(dispute);
      expect(accessLogs.logDocumentAccess).toHaveBeenCalledWith(
        dto.documentId,
        `dispute_filed:${DisputeStatus.OPEN}`,
        'user-id-456',
      );
      expect(result).toMatchObject({
        id: dispute.id,
        documentId: dto.documentId,
        status: DisputeStatus.OPEN,
      });
    });

    it('should return 409 with the existing dispute id when an open dispute exists', async () => {
      const existing = makeDispute({ id: 'existing-open-dispute' });
      repo.findOne.mockResolvedValue(existing);

      const error = await service.fileDispute(dto, 'user-1').catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.response).toMatchObject({
        disputeId: existing.id,
        existingDisputeId: existing.id,
      });
      expect(classifier.classifyDispute).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(accessLogs.logDocumentAccess).not.toHaveBeenCalled();
    });

    it('should return 409 when a dispute is already in review', async () => {
      const existing = makeDispute({
        id: 'existing-in-review-dispute',
        status: DisputeStatus.IN_REVIEW,
      });
      repo.findOne.mockResolvedValue(existing);

      const error = await service.fileDispute(dto, 'user-1').catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.response).toMatchObject({ disputeId: existing.id });
    });

    it('should allow filing again after the previous dispute was resolved', async () => {
      repo.findOne.mockResolvedValue(null);
      const fresh = makeDispute({ id: 'new-dispute' });
      repo.create.mockReturnValue(fresh);
      repo.save.mockResolvedValue(fresh);

      const result = await service.fileDispute(dto, 'user-1');

      expect(result.id).toBe(fresh.id);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should return 409 when a concurrent insert violates the partial unique index', async () => {
      const concurrentDispute = makeDispute({
        id: 'concurrent-dispute',
      });
      repo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(concurrentDispute);
      repo.create.mockReturnValue(makeDispute());
      repo.save.mockRejectedValueOnce({ code: '23505' });

      const error = await service.fileDispute(dto, 'user-1').catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.response).toMatchObject({ disputeId: concurrentDispute.id });
      expect(accessLogs.logDocumentAccess).not.toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('should return disputes for a user', async () => {
      const dispute = makeDispute({ filedBy: 'user-id-456' });
      repo.findAndCount.mockResolvedValue([[dispute], 1]);

      const result = await service.findByUser('user-id-456');

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { filedBy: 'user-id-456' },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a dispute if found', async () => {
      const dispute = makeDispute({ id: 'dispute-id-1' });
      repo.findOne.mockResolvedValue(dispute);

      const result = await service.findOne(dispute.id, 'user-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: dispute.id } });
      expect(result.id).toBe(dispute.id);
    });

    it('should throw NotFoundException if dispute not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if a user tries to access a dispute they did not file', async () => {
      repo.findOne.mockResolvedValue(makeDispute());

      await expect(
        service.findOne('dispute-1', 'another-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
