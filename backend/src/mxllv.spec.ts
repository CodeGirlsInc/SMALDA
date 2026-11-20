import { QueueObservabilityController } from './queue/queue-observability.controller';
import { QueueService } from './queue/queue.service';

describe('mxllv Backend Features (BE-140, BE-139, BE-138, BE-137)', () => {
  it('lists failed jobs and retries them', async () => {
    const job = {
      id: 'job-101',
      name: 'analyze',
      data: { documentId: 'doc-1' },
      attemptsMade: 3,
      finishedOn: Date.now(),
      failedReason: 'Stellar timeout',
      retry: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getFailed: jest.fn().mockResolvedValue([job]),
      getJob: jest.fn().mockResolvedValue(job),
    };
    const controller = new QueueObservabilityController({
      getQueue: () => queue,
    } as unknown as QueueService);

    const failed = await controller.getDeadLetterJobs();
    expect(failed.count).toBe(1);

    const retry = await controller.retryDeadLetterJob('job-101');
    expect(retry.status).toBe('requeued');
    expect(job.retry).toHaveBeenCalled();
  });
});
