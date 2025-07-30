import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimelineGeneratorService } from './timeline-generator.service';
import { Document } from '../document-history/entities/document.entity';
import { DocumentVersion } from '../document-history/entities/document-version.entity';
import { Review } from '../review/entities/review.entity';
import { Activity } from '../activity-tracker/entities/activity.entity';
import { Repository } from 'typeorm';

const mockDocumentRepo = () => ({ find: jest.fn() });
const mockVersionRepo = () => ({ find: jest.fn() });
const mockReviewRepo = () => ({ find: jest.fn() });
const mockActivityRepo = () => ({ find: jest.fn() });

describe('TimelineGeneratorService', () => {
  let service: TimelineGeneratorService;
  let documentRepo: Repository<Document>;
  let versionRepo: Repository<DocumentVersion>;
  let reviewRepo: Repository<Review>;
  let activityRepo: Repository<Activity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineGeneratorService,
        { provide: getRepositoryToken(Document), useFactory: mockDocumentRepo },
        { provide: getRepositoryToken(DocumentVersion), useFactory: mockVersionRepo },
        { provide: getRepositoryToken(Review), useFactory: mockReviewRepo },
        { provide: getRepositoryToken(Activity), useFactory: mockActivityRepo },
      ],
    }).compile();

    service = module.get<TimelineGeneratorService>(TimelineGeneratorService);
    documentRepo = module.get(getRepositoryToken(Document));
    versionRepo = module.get(getRepositoryToken(DocumentVersion));
    reviewRepo = module.get(getRepositoryToken(Review));
    activityRepo = module.get(getRepositoryToken(Activity));
  });

  it('should throw NotFoundException if no caseId is provided', async () => {
    await expect(service.generateTimeline('')).rejects.toThrow('Case ID is required');
  });

  it('should throw NotFoundException if no documents found', async () => {
    (documentRepo.find as jest.Mock).mockResolvedValue([]);
    await expect(service.generateTimeline('case-1')).rejects.toThrow('No documents found for this case');
  });

  it('should aggregate and sort events correctly', async () => {
    (documentRepo.find as jest.Mock).mockResolvedValue([
      { id: 'doc1', ownerId: 'case-1' } as Document,
      { id: 'doc2', ownerId: 'case-1' } as Document,
    ]);
    (versionRepo.find as jest.Mock).mockResolvedValue([
      { documentId: 'doc1', createdAt: new Date('2023-01-01'), uploadNotes: 'note1', versionNumber: 1 } as DocumentVersion,
      { documentId: 'doc2', createdAt: new Date('2023-01-02'), uploadNotes: 'note2', versionNumber: 1 } as DocumentVersion,
    ]);
    (reviewRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'review1',
        documentId: 'doc1',
        createdAt: new Date('2023-01-03'),
        decision: 'approved',
        status: 'COMPLETED',
        reviewerId: 'user1',
        aiRiskLevel: 'LOW',
        aiConfidenceScore: 0.9,
        aiDetectionDetails: {},
        reviewerRiskLevel: 'LOW',
        reviewerNotes: '',
        reviewMetadata: {},
        timeSpentMinutes: 10,
        escalationReason: '',
        isEscalated: false,
        priorityLevel: 1,
        updatedAt: new Date('2023-01-03'),
        reviewedAt: new Date('2023-01-03'),
        dueDate: new Date('2023-01-04'),
        reviewer: null,
        document: null,
        comments: [],
      } as unknown as Review,
    ]);
    (activityRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'activity1',
        userId: 'doc1',
        timestamp: new Date('2023-01-04'),
        actionType: 'DOCUMENT_UPLOAD',
        details: { documentId: 'doc1' },
      } as unknown as Activity,
    ]);

    const timeline = await service.generateTimeline('case-1');
    expect(timeline).toHaveLength(4);
    expect(timeline[0].type).toBe('document_upload');
    expect(timeline[1].type).toBe('document_upload');
    expect(timeline[2].type).toBe('court_hearing');
    expect(timeline[3].type).toBe('action');
    expect(new Date(timeline[0].date) <= new Date(timeline[1].date)).toBe(true);
    expect(new Date(timeline[1].date) <= new Date(timeline[2].date)).toBe(true);
    expect(new Date(timeline[2].date) <= new Date(timeline[3].date)).toBe(true);
  });
}); 