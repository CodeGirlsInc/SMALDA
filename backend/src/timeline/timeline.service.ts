import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Document } from '../document-history/entities/document.entity';
import { DocumentVersion } from '../document-history/entities/document-version.entity';
import { Review } from '../review/entities/review.entity';
import { Activity } from '../activity-tracker/entities/activity.entity';

@Injectable()
export class TimelineGeneratorService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly documentVersionRepository: Repository<DocumentVersion>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
  ) {}

  async generateTimeline(caseId: string) {
    if (!caseId) throw new NotFoundException('Case ID is required');

    // Fetch all documents for the case
    const documents = await this.documentRepository.find({ where: { ownerId: caseId } });
    if (!documents.length) throw new NotFoundException('No documents found for this case');
    const documentIds = documents.map(d => d.id);

    // Document upload events (from document versions)
    const versions = await this.documentVersionRepository.find({ where: { documentId: In(documentIds) } });
    const documentEvents = versions.map(v => ({
      type: 'document_upload',
      date: v.createdAt,
      note: v.uploadNotes || v.documentUrl,
      documentId: v.documentId,
      versionNumber: v.versionNumber,
    }));

    // Hearings (reviews)
    const reviews = await this.reviewRepository.find({ where: { documentId: In(documentIds) } });
    const hearingEvents = reviews.map(r => ({
      type: 'court_hearing',
      date: r.createdAt,
      outcome: r.decision,
      status: r.status,
      documentId: r.documentId,
      reviewerId: r.reviewerId,
    }));

    // Actions (activities)
    const activities = await this.activityRepository.find({ where: { userId: In(documentIds) } }); 
    const actionEvents = activities
      .filter(a => documentIds.includes(a.details?.documentId))
      .map(a => ({
        type: 'action',
        date: a.timestamp,
        actionType: a.actionType,
        details: a.details,
      }));

    // Aggregate and sort
    const timeline = [...documentEvents, ...hearingEvents, ...actionEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return timeline;
  }
} 