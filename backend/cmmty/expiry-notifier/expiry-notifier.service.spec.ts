import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { MailService } from '../../src/mail/mail.service';
import { ExpiryNotificationLog } from './expiry-notification-log.entity';
import { ExpiryNotifierService } from './expiry-notifier.service';

describe('ExpiryNotifierService', () => {
  let service: ExpiryNotifierService;

  const mockDocumentRepository = {
    find: jest.fn(),
  };

  const mockNotificationLogRepository = {
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };

  const mockMailService = {
    sendRiskAlert: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpiryNotifierService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepository,
        },
        {
          provide: getRepositoryToken(ExpiryNotificationLog),
          useValue: mockNotificationLogRepository,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<ExpiryNotifierService>(ExpiryNotifierService);
  });

  it('should detect expired documents not notified in the last 7 days', async () => {
    mockDocumentRepository.find.mockResolvedValue([
      {
        id: 'doc-1',
        ownerId: 'owner-1',
        title: 'Expired Document 1',
        riskFlags: ['EXPIRED_DOCUMENT'],
        owner: { email: 'owner1@example.com' },
      },
      {
        id: 'doc-2',
        ownerId: 'owner-2',
        title: 'Expired Document 2',
        riskFlags: ['EXPIRED_DOCUMENT'],
        owner: { email: 'owner2@example.com' },
      },
      {
        id: 'doc-3',
        ownerId: 'owner-3',
        title: 'Safe Document',
        riskFlags: [],
        owner: { email: 'owner3@example.com' },
      },
    ]);

    mockNotificationLogRepository.find.mockResolvedValue([{ documentId: 'doc-2' }]);

    const result = await service.findDocumentsToNotify(new Date('2026-04-25T08:00:00.000Z'));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('doc-1');
  });

  it('should send emails and save logs for detected documents', async () => {
    jest.spyOn(service, 'findDocumentsToNotify').mockResolvedValue([
      {
        id: 'doc-1',
        ownerId: 'owner-1',
        title: 'Expired Document 1',
        owner: { email: 'owner1@example.com' },
      } as Document,
    ]);

    await service.processExpiredDocuments();

    expect(mockMailService.sendRiskAlert).toHaveBeenCalledWith(
      'owner1@example.com',
      'Expired Document 1',
      ['EXPIRED_DOCUMENT'],
    );
    expect(mockNotificationLogRepository.save).toHaveBeenCalled();
  });
});
