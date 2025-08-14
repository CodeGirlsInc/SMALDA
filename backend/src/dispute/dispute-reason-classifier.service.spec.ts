// src/dispute-reason-classifier/dispute-reason-classifier.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { DisputeReason } from './entities/dispute-reason.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

const mockReasons: DisputeReason[] = [
  { id: 1, name: 'Fraud', description: 'Unauthorized transaction' },
  { id: 2, name: 'Duplicate', description: 'Duplicate charge' },
  { id: 3, name: 'Product not received', description: 'Item was not delivered' },
];

describe('DisputeReasonClassifierService', () => {
  let service: DisputeReasonClassifierService;
  let repo: Repository<DisputeReason>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeReasonClassifierService,
        {
          provide: getRepositoryToken(DisputeReason),
          useValue: {
            find: jest.fn().mockResolvedValue(mockReasons),
          },
        },
      ],
    }).compile();

    service = module.get<DisputeReasonClassifierService>(DisputeReasonClassifierService);
    repo = module.get<Repository<DisputeReason>>(getRepositoryToken(DisputeReason));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the matched reason based on description', async () => {
    const result = await service.classifyDispute('This is a fraud case');
    expect(result).toEqual(mockReasons[0]);
  });

  it('should return null if no reason matches', async () => {
    const result = await service.classifyDispute('Unrelated issue');
    expect(result).toBeNull();
  });
});
