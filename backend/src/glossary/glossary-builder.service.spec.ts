import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GlossaryBuilderService } from './glossary-builder.service';
import { GlossaryTerm } from './glossary-term.entity';
import { Repository } from 'typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('GlossaryBuilderService', () => {
  let service: GlossaryBuilderService;
  let repo: Repository<GlossaryTerm>;

  const mockGlossaryRepo = {
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlossaryBuilderService,
        {
          provide: getRepositoryToken(GlossaryTerm),
          useValue: mockGlossaryRepo,
        },
      ],
    }).compile();

    service = module.get<GlossaryBuilderService>(GlossaryBuilderService);
    repo = module.get<Repository<GlossaryTerm>>(getRepositoryToken(GlossaryTerm));
  });

  it('should extract unique capitalized terms from text', async () => {
    const terms = await service.extractTermsFromText('The Court said Law is important');
    expect(terms).toEqual(expect.arrayContaining(['The', 'Court', 'Law']));
  });

  it('should build glossary by saving new terms', async () => {
    mockGlossaryRepo.findOne.mockResolvedValue(null);
    mockGlossaryRepo.create.mockImplementation((term) => term);
    mockGlossaryRepo.save.mockImplementation((term) => Promise.resolve({ id: 1, ...term }));

    const result = await service.buildFromDocument('Court Law Court');
    expect(mockGlossaryRepo.save).toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should search glossary terms', async () => {
    const mockResult = [{ id: 1, term: 'Court' }];
    mockGlossaryRepo.find.mockResolvedValue(mockResult);

    const result = await service.searchTerm('Court');
    expect(result).toEqual(mockResult);
  });
});
