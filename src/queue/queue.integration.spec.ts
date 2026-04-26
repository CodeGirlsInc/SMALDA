import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

// Mock dependencies (like DB repositories) since we only want to integration test BullMQ+Redis logic
const mockDocumentRepository = {
  updateStatus: jest.fn(),
  createVerificationRecord: jest.fn(),
};

describe('Queue Processing Pipeline Integration', () => {
  let redisConnection: Redis;
  let analyzeQueue: Queue;
  let analyzeWorker: Worker;
  let anchorQueue: Queue;
  let anchorWorker: Worker;

  beforeAll(async () => {
    // Acceptance Criteria: Use a real Redis instance (do not mock BullMQ)
    // Assumes a local Redis or test-container is running
    redisConnection = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    });

    analyzeQueue = new Queue('analyze-queue', { connection: redisConnection });
    anchorQueue = new Queue('anchor-queue', { connection: redisConnection });
  });

  afterAll(async () => {
    if (analyzeWorker) await analyzeWorker.close();
    if (anchorWorker) await anchorWorker.close();
    await analyzeQueue.close();
    await anchorQueue.close();
    redisConnection.disconnect();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await analyzeQueue.obliterate({ force: true });
    await anchorQueue.obliterate({ force: true });
  });

  it('tests the full analyze job: PENDING → ANALYZING → VERIFIED/FLAGGED', async () => {
    analyzeWorker = new Worker('analyze-queue', async (job: Job) => {
      mockDocumentRepository.updateStatus(job.data.documentId, 'ANALYZING');
      
      // Simulate analysis logic
      const isVerified = job.data.content === 'valid_content';
      const finalStatus = isVerified ? 'VERIFIED' : 'FLAGGED';
      
      mockDocumentRepository.updateStatus(job.data.documentId, finalStatus);
      return { status: finalStatus };
    }, { connection: redisConnection });

    const job = await analyzeQueue.add('analyze-doc', { documentId: 'doc-1', content: 'valid_content' });
    const result = await job.waitUntilFinished(analyzeWorker.client);

    expect(mockDocumentRepository.updateStatus).toHaveBeenNthCalledWith(1, 'doc-1', 'ANALYZING');
    expect(mockDocumentRepository.updateStatus).toHaveBeenNthCalledWith(2, 'doc-1', 'VERIFIED');
    expect(result.status).toBe('VERIFIED');
  });

  it('tests the full anchor job: VerificationRecord created with correct status', async () => {
    anchorWorker = new Worker('anchor-queue', async (job: Job) => {
      mockDocumentRepository.createVerificationRecord(job.data.documentId, 'ANCHORED');
      return { success: true };
    }, { connection: redisConnection });

    const job = await anchorQueue.add('anchor-doc', { documentId: 'doc-2' });
    await job.waitUntilFinished(anchorWorker.client);

    expect(mockDocumentRepository.createVerificationRecord).toHaveBeenCalledWith('doc-2', 'ANCHORED');
  });

  it('tests job failure: document status set to REJECTED after all retries exhausted', async () => {
    analyzeWorker = new Worker('analyze-queue', async (job: Job) => {
      throw new Error('Analysis failed'); // Force failure
    }, { connection: redisConnection });

    analyzeWorker.on('failed', async (job, err) => {
      if (job && job.attemptsMade === job.opts.attempts) {
        // Exhausted all retries
        mockDocumentRepository.updateStatus(job.data.documentId, 'REJECTED');
      }
    });

    const job = await analyzeQueue.add(
      'analyze-doc-fail', 
      { documentId: 'doc-3' }, 
      { attempts: 3, backoff: { type: 'fixed', delay: 100 } }
    );
    
    try {
      await job.waitUntilFinished(analyzeWorker.client);
    } catch (e) {
      // Expected to throw after all retries
    }

    // Wait slightly to ensure the failed event logic completes
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockDocumentRepository.updateStatus).toHaveBeenCalledWith('doc-3', 'REJECTED');
  });

  it('tests job deduplication: second anchor job for the same document is not enqueued', async () => {
    const jobId = 'unique-anchor-job-doc-4'; // Dedup key
    
    // Add same job twice
    const job1 = await anchorQueue.add('anchor-doc', { documentId: 'doc-4' }, { jobId });
    const job2 = await anchorQueue.add('anchor-doc', { documentId: 'doc-4' }, { jobId });

    // BullMQ deduplicates based on jobId. If the job already exists, it returns the existing one
    expect(job1.id).toBe(job2.id);
    
    const count = await anchorQueue.getWaitingCount();
    expect(count).toBe(1); // Only 1 job actually waiting
  });
});
