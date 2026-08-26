import { Test, TestingModule } from '@nestjs/testing';
import { QueueObservabilityController } from './queue-observability.controller';
import { QueueService } from './queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const mockJob = {
  id: 'job-1',
  name: 'analyze',
  data: { documentId: 'doc-1' },
  attemptsMade: 3,
  failedReason: 'Stellar timeout',
  finishedOn: Date.now(),
  retry: jest.fn().mockResolvedValue(undefined),
};

const mockQueue = {
  getFailed: jest.fn().mockResolvedValue([mockJob]),
  getJob: jest.fn().mockImplementation((id: string) => {
    if (id === 'job-1') return Promise.resolve(mockJob);
    return Promise.resolve(null);
  }),
};

const mockQueueService = {
  getQueue: jest.fn().mockReturnValue(mockQueue),
};

describe('QueueObservabilityController', () => {
  let controller: QueueObservabilityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueObservabilityController],
      providers: [{ provide: QueueService, useValue: mockQueueService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<QueueObservabilityController>(
      QueueObservabilityController,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDeadLetterJobs()', () => {
    it('should return failed jobs from the queue', async () => {
      const result = await controller.getDeadLetterJobs();
      expect(mockQueue.getFailed).toHaveBeenCalled();
      expect(result.count).toBe(1);
      expect(result.jobs[0].id).toBe('job-1');
      expect(result.jobs[0].name).toBe('analyze');
      expect(result.jobs[0].attemptsMade).toBe(3);
    });

    it('should return empty list when no failed jobs', async () => {
      mockQueue.getFailed.mockResolvedValueOnce([]);
      const result = await controller.getDeadLetterJobs();
      expect(result.count).toBe(0);
      expect(result.jobs).toEqual([]);
    });
  });

  describe('retryDeadLetterJob()', () => {
    it('should requeue a failed job', async () => {
      const result = await controller.retryDeadLetterJob('job-1');
      expect(mockQueue.getJob).toHaveBeenCalledWith('job-1');
      expect(mockJob.retry).toHaveBeenCalled();
      expect(result).toEqual({ status: 'requeued', jobId: 'job-1' });
    });

    it('should throw NotFoundException for non-existent job', async () => {
      await expect(
        controller.retryDeadLetterJob('nonexistent'),
      ).rejects.toThrow('not found');
    });
  });
});
