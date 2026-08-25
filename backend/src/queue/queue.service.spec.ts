import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

jest.mock('bullmq');

describe('QueueService', () => {
  let service: QueueService;
  let queue: jest.Mocked<Queue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return '6379';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    queue = (Queue as jest.Mock).mock.instances[0];
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueAnalyze', () => {
    it('should add an analyze job to the queue', async () => {
      const documentId = 'doc-1';
      await service.enqueueAnalyze(documentId);
      expect(queue.add).toHaveBeenCalledWith('analyze', {
        documentId,
        requestId: undefined,
      });
    });
  });

  describe('enqueueAnchor', () => {
    it('should add an anchor job to the queue', async () => {
      const documentId = 'doc-1';
      await service.enqueueAnchor(documentId);
      expect(queue.add).toHaveBeenCalledWith('anchor', {
        documentId,
        requestId: undefined,
      });
    });
  });
});
