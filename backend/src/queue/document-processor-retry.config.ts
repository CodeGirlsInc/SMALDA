/**
 * Exponential backoff retry configuration for document processor jobs,
 * replacing the previous default (no backoff) job options.
 */
export const documentProcessorJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: true,
};
