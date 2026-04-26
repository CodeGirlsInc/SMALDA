import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentSearchService } from './document-search.service';
import { Document, DocumentStatus } from '../../src/documents/entities/document.entity';

describe('DocumentSearchService', () => {
  let service: DocumentSearchService;
  let repository: Repository<Document>;

  const mockQueryBuilder = {
    andWhere: jest.fn().returnThis(),
    skip: jest.fn().returnThis(),
    take: jest.fn().returnThis(),
    orderBy: jest.fn().returnThis(),
    getCount: jest.fn().mockResolvedValue(2),
    getMany: jest.fn().mockResolvedValue([
      { id: '1', title: 'Test Document 1', status: DocumentStatus.VERIFIED },
      { id: '2', title: 'Test Document 2', status: DocumentStatus.PENDING },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentSearchService,
        {
          provide: getRepositoryToken(Document),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentSearchService>(DocumentSearchService);
    repository = module.get<Repository<Document>>(getRepositoryToken(Document));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should search documents with query string', async () => {
    const dto = { q: 'test', page: 1, limit: 10 };
    const result = await service.search(dto);

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'document.title ILIKE :q',
      expect.objectContaining({ q: '%test%' }),
    );
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('should filter documents by status', async () => {
    const dto = { status: DocumentStatus.VERIFIED, page: 1, limit: 10 };
    const result = await service.search(dto);

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'document.status = :status',
      expect.objectContaining({ status: DocumentStatus.VERIFIED }),
    );
    expect(result.data).toHaveLength(2);
  });

  it('should filter documents by risk score range', async () => {
    const dto = { minScore: 0, maxScore: 50, page: 1, limit: 10 };
    const result = await service.search(dto);

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'document.riskScore >= :minScore',
      expect.objectContaining({ minScore: 0 }),
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'document.riskScore <= :maxScore',
      expect.objectContaining({ maxScore: 50 }),
    );
    expect(result.data).toHaveLength(2);
  });
});