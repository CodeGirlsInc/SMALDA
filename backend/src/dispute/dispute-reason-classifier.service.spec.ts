import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { DisputeReason } from './entities/dispute-reason.entity';

const mockReasons: DisputeReason[] = [
  { id: '1', name: 'Unauthorized Transaction' },
  { id: '2', name: 'Duplicate Payment' },
  { id: '3', name: 'Service Not Rendered' },
  { id: '4', name: 'Item Not Received' },
  { id: '5', name: 'Defective Product' },
  { id: '6', name: 'Billing Error' },
];

const mockRepository = {
  find: jest.fn().mockResolvedValue(mockReasons),
};

describe('DisputeReasonClassifierService', () => {
  let service: DisputeReasonClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeReasonClassifierService,
        {
          provide: getRepositoryToken(DisputeReason),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DisputeReasonClassifierService>(
      DisputeReasonClassifierService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllReasons()', () => {
    it('should return all dispute reasons from the repository', async () => {
      const result = await service.findAllReasons();
      expect(result).toEqual(mockReasons);
      expect(mockRepository.find).toHaveBeenCalled();
    });
  });

  describe('classifyDispute()', () => {
    it('should match "Unauthorized Transaction" for fraud-related descriptions', async () => {
      const result = await service.classifyDispute(
        'This is an Unauthorized Transaction on my account',
      );
      expect(result).toBeDefined();
      expect(result!.id).toBe('1');
      expect(result!.name).toBe('Unauthorized Transaction');
    });

    it('should match "Duplicate Payment" when payment was charged twice', async () => {
      const result = await service.classifyDispute(
        'I was charged twice for the same order — it is a duplicate payment',
      );
      expect(result).toBeDefined();
      expect(result!.id).toBe('2');
      expect(result!.name).toBe('Duplicate Payment');
    });

    it('should match "Service Not Rendered" for service complaints', async () => {
      const result = await service.classifyDispute(
        'Service Not Rendered even though I paid for it',
      );
      expect(result).toBeDefined();
      expect(result!.id).toBe('3');
      expect(result!.name).toBe('Service Not Rendered');
    });

    it('should match "Item Not Received" for shipping complaints', async () => {
      const result = await service.classifyDispute(
        'My Item Not Received after 30 days of waiting',
      );
      expect(result).toBeDefined();
      expect(result!.id).toBe('4');
      expect(result!.name).toBe('Item Not Received');
    });

    it('should match "Defective Product" for quality issues', async () => {
      const result = await service.classifyDispute(
        'The defective product arrived broken and unusable',
      );
      expect(result).toBeDefined();
      expect(result!.id).toBe('5');
      expect(result!.name).toBe('Defective Product');
    });

    it('should match "Billing Error" for incorrect charges', async () => {
      const result = await service.classifyDispute(
        'There is a billing error on my statement for $50 overcharge',
      );
      expect(result).toBeDefined();
      expect(result!.id).toBe('6');
      expect(result!.name).toBe('Billing Error');
    });

    it('should match case-insensitively', async () => {
      const result = await service.classifyDispute(
        'UNAUTHORIZED TRANSACTION detected',
      );
      expect(result).toBeDefined();
      expect(result!.name).toBe('Unauthorized Transaction');
    });

    it('should return the first matching reason when multiple match', async () => {
      const result = await service.classifyDispute(
        'Unauthorized Transaction and Billing Error both apply',
      );
      expect(result).toBeDefined();
      // Should return the first match in array order
      expect(result!.name).toBe('Unauthorized Transaction');
    });

    it('should return null for a description that matches no reason (fallback/unclassified)', async () => {
      const result = await service.classifyDispute(
        'I just want my money back for reasons unrelated to anything',
      );
      expect(result).toBeNull();
    });

    it('should return null for an empty description', async () => {
      const result = await service.classifyDispute('');
      expect(result).toBeNull();
    });

    it('should return null when the reasons table is empty', async () => {
      mockRepository.find.mockResolvedValueOnce([]);
      const result = await service.classifyDispute(
        'Unauthorized Transaction',
      );
      expect(result).toBeNull();
    });
  });
});
