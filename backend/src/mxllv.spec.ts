import { QueueObservabilityController } from './queue/queue-observability.controller';

describe('mxllv Backend Features (BE-140, BE-139, BE-138, BE-137)', () => {
  it('QueueObservabilityController lists dead letter queue and retries jobs', () => {
    const controller = new QueueObservabilityController();
    const failed = controller.getFailedJobs();
    expect(failed.count).toBe(1);

    const retry = controller.retryJob('job-101');
    expect(retry.status).toBe('requeued');
    expect(controller.getFailedJobs().count).toBe(0);
  });
});
