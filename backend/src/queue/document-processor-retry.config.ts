import { JobsOptions } from 'bullmq';

export const documentProcessorJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: true,
};
