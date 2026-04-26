import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { MailService } from '../../src/mail/mail.service';
import { ExpiryNotificationLog } from './expiry-notification-log.entity';

@Injectable()
export class ExpiryNotifierService {
  private readonly logger = new Logger(ExpiryNotifierService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(ExpiryNotificationLog)
    private readonly notificationLogRepository: Repository<ExpiryNotificationLog>,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDailyExpiryNotifications(): Promise<void> {
    await this.processExpiredDocuments();
  }

  async processExpiredDocuments(referenceDate = new Date()): Promise<void> {
    const documentsToNotify = await this.findDocumentsToNotify(referenceDate);

    for (const document of documentsToNotify) {
      await this.mailService.sendRiskAlert(document.owner.email, document.title, ['EXPIRED_DOCUMENT']);

      await this.notificationLogRepository.save(
        this.notificationLogRepository.create({
          documentId: document.id,
          userId: document.ownerId,
        }),
      );

      this.logger.log(`Sent expiry notification for document ${document.id} to ${document.owner.email}`);
    }
  }

  async findDocumentsToNotify(referenceDate = new Date()): Promise<Document[]> {
    const threshold = new Date(referenceDate);
    threshold.setDate(threshold.getDate() - 7);

    const allDocuments = await this.documentRepository.find({ relations: ['owner'] });
    const expiredDocuments = allDocuments.filter(
      (document) =>
        Array.isArray(document.riskFlags) &&
        document.riskFlags.includes('EXPIRED_DOCUMENT') &&
        Boolean(document.owner?.email),
    );

    if (!expiredDocuments.length) {
      return [];
    }

    const recentNotificationLogs = await this.notificationLogRepository.find({
      where: {
        documentId: In(expiredDocuments.map((document) => document.id)),
        sentAt: MoreThan(threshold),
      },
    });

    const recentlyNotifiedDocumentIds = new Set(
      recentNotificationLogs.map((notificationLog) => notificationLog.documentId),
    );

    return expiredDocuments.filter(
      (document) => !recentlyNotifiedDocumentIds.has(document.id),
    );
  }
}
