// src/case-change-detector/__tests__/case-change-detector.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CaseChangeDetectorService } from '../case-change-detector.service';
import { Case } from '../types/case.type';

describe('CaseChangeDetectorService', () => {
  let service: CaseChangeDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaseChangeDetectorService],
    }).compile();

    service = module.get<CaseChangeDetectorService>(CaseChangeDetectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect no changes if case is unchanged', () => {
    const case1: Case = {
      id: '1',
      status: 'open',
      assignedTo: 'user1',
      priority: 'medium',
      updatedAt: new Date('2023-01-01'),
    };

    const result = service.detectChanges(case1, { ...case1 });
    expect(result).toEqual({});
  });

  it('should detect changed fields', () => {
    const oldCase: Case = {
      id: '1',
      status: 'open',
      assignedTo: 'user1',
      priority: 'medium',
      updatedAt: new Date('2023-01-01'),
    };

    const newCase: Case = {
      ...oldCase,
      status: 'closed',
      priority: 'high',
    };

    const result = service.detectChanges(oldCase, newCase);

    expect(result).toEqual({
      status: { old: 'open', new: 'closed' },
      priority: { old: 'medium', new: 'high' },
    });
  });

  it('should handle newly added fields gracefully', () => {
    const oldCase: Case = {
      id: '1',
      status: 'open',
      assignedTo: 'user1',
      priority: 'medium',
      updatedAt: new Date('2023-01-01'),
    };

    const newCase: Case = {
      ...oldCase,
      comments: ['Initial review'],
    };

    const result = service.detectChanges(oldCase, newCase);

    expect(result).toEqual({});
  });
});
