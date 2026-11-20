import { JobsOptions } from 'bullmq';

export const documentProcessorJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: true,
  // Keep exhausted jobs around for inspection, but clean up old ones.
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};
