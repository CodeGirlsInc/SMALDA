import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisputeService } from './dispute.service';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { NotFoundException } from '@nestjs/common';

const mockDispute = {
  id: 'dispute-1',
  documentId: 'doc-1',
  description: 'Invalid signature',
  reason: null,
  filedBy: 'user-1',
  status: DisputeStatus.OPEN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo = () => ({
  create: jest.fn().mockReturnValue(mockDispute),
  save: jest.fn().mockResolvedValue(mockDispute),
  findAndCount: jest.fn().mockResolvedValue([[mockDispute], 1]),
  findOne: jest.fn().mockResolvedValue(null),
});

const mockClassifier = {
  classifyDispute: jest.fn().mockResolvedValue(null),
};

const mockAccessLogs = {
  logDocumentAccess: jest.fn().mockResolvedValue(undefined),
};

describe('DisputeService', () => {
  let service: DisputeService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    repo = mockRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeService,
        { provide: getRepositoryToken(Dispute), useValue: repo },
        { provide: DisputeReasonClassifierService, useValue: mockClassifier },
        { provide: AccessLogsService, useValue: mockAccessLogs },
      ],
    }).compile();

    service = module.get<DisputeService>(DisputeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fileDispute()', () => {
    it('should create a dispute with OPEN status', async () => {
      const result = await service.fileDispute(
        { documentId: 'doc-1', description: 'test' },
        'user-1',
      );
      expect(result.status).toBe(DisputeStatus.OPEN);
      expect(mockAccessLogs.logDocumentAccess).toHaveBeenCalled();
    });
  });

  describe('updateStatus()', () => {
    it('should update dispute status and audit log', async () => {
      repo.findOne.mockResolvedValueOnce({ ...mockDispute });
      const result = await service.updateStatus(
        'dispute-1',
        DisputeStatus.RESOLVED,
        'admin-1',
      );
      expect(result.status).toBe(DisputeStatus.RESOLVED);
      expect(mockAccessLogs.logDocumentAccess).toHaveBeenCalledWith(
        'doc-1',
        `dispute_status_changed:${DisputeStatus.OPEN}->${DisputeStatus.RESOLVED}`,
        'admin-1',
      );
    });

    it('should throw if dispute not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.updateStatus('nonexistent', DisputeStatus.RESOLVED, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne()', () => {
    it('should return dispute', async () => {
      repo.findOne.mockResolvedValueOnce({ ...mockDispute });
      const result = await service.findOne('dispute-1');
      expect(result.id).toBe('dispute-1');
      expect(result.status).toBe(DisputeStatus.OPEN);
    });

    it('should throw if not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
