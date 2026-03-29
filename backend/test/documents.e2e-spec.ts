import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';

import { DocumentsController } from '../src/documents/documents.controller';
import { DocumentsService } from '../src/documents/documents.service';
import { QueueService } from '../src/queue/queue.service';
import { VerificationService } from '../src/verification/verification.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { DocumentStatus } from '../src/documents/entities/document.entity';
import { VerificationStatus } from '../src/verification/entities/verification-record.entity';

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const MOCK_DOC = {
  id: 'doc-1',
  ownerId: 'user-1',
  title: 'test.pdf',
  fileHash: 'abc123',
  fileSize: 1000,
  mimeType: 'application/pdf',
  status: DocumentStatus.PENDING,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_VERIFICATION = {
  id: 'ver-1',
  documentId: 'doc-1',
  stellarTxHash: 'tx123',
  stellarLedger: 42,
  status: VerificationStatus.CONFIRMED,
  createdAt: new Date(),
};

const authenticatedGuard = {
  canActivate: (ctx: any) => {
    ctx.switchToHttp().getRequest().user = MOCK_USER;
    return true;
  },
};

async function buildApp(guardOverride = authenticatedGuard): Promise<{ app: INestApplication; services: any }> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [DocumentsController],
    providers: [
      { provide: DocumentsService, useValue: { findByFileHash: jest.fn(), create: jest.fn(), findById: jest.fn(), findByOwner: jest.fn() } },
      { provide: QueueService, useValue: { enqueueAnalyze: jest.fn(), enqueueAnchor: jest.fn() } },
      { provide: VerificationService, useValue: { findLatestByDocument: jest.fn() } },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('/tmp/test-uploads') } },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(guardOverride)
    .compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return {
    app,
    services: {
      docs: module.get<DocumentsService>(DocumentsService) as jest.Mocked<DocumentsService>,
      queue: module.get<QueueService>(QueueService) as jest.Mocked<QueueService>,
      verification: module.get<VerificationService>(VerificationService) as jest.Mocked<VerificationService>,
    },
  };
}

describe('Documents (e2e)', () => {
  let app: INestApplication;
  let docs: jest.Mocked<DocumentsService>;
  let queue: jest.Mocked<QueueService>;
  let verification: jest.Mocked<VerificationService>;

  beforeAll(async () => {
    const result = await buildApp();
    app = result.app;
    docs = result.services.docs;
    queue = result.services.queue;
    verification = result.services.verification;
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // ── POST /api/documents/upload ──────────────────────────────────────────────

  describe('POST /api/documents/upload', () => {
    it('202 on successful upload', async () => {
      docs.findByFileHash.mockResolvedValueOnce(null);
      docs.create.mockResolvedValueOnce(MOCK_DOC as any);
      queue.enqueueAnalyze.mockResolvedValueOnce(undefined as any);

      await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', Buffer.from('hello pdf'), { filename: 'test.pdf', contentType: 'application/pdf' })
        .expect(202);
    });

    it('200 when document hash already exists', async () => {
      docs.findByFileHash.mockResolvedValueOnce(MOCK_DOC as any);

      await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', Buffer.from('hello pdf'), { filename: 'test.pdf', contentType: 'application/pdf' })
        .expect(200);
    });

    it('400 for unsupported MIME type', async () => {
      await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', Buffer.from('text content'), { filename: 'test.txt', contentType: 'text/plain' })
        .expect(400);
    });

    it('400 for oversized file', async () => {
      const oversized = Buffer.alloc(21 * 1024 * 1024); // 21 MB

      await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', oversized, { filename: 'big.pdf', contentType: 'application/pdf' })
        .expect(400);
    });

    it('401 when unauthenticated', async () => {
      const { app: unauthApp } = await buildApp({ canActivate: () => { throw new UnauthorizedException(); } } as any);

      await request(unauthApp.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', Buffer.from('content'), { filename: 'test.pdf', contentType: 'application/pdf' })
        .expect(401);

      await unauthApp.close();
    });
  });

  // ── POST /api/documents/:id/verify ─────────────────────────────────────────

  describe('POST /api/documents/:id/verify', () => {
    it('202 on successful verification queue', async () => {
      docs.findById.mockResolvedValueOnce(MOCK_DOC as any);
      queue.enqueueAnchor.mockResolvedValueOnce(undefined as any);

      await request(app.getHttpServer())
        .post('/api/documents/doc-1/verify')
        .expect(202);
    });

    it('404 when document not found', async () => {
      docs.findById.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .post('/api/documents/nonexistent/verify')
        .expect(404);
    });

    it('403 when user is not the document owner', async () => {
      docs.findById.mockResolvedValueOnce({ ...MOCK_DOC, ownerId: 'other-user' } as any);

      await request(app.getHttpServer())
        .post('/api/documents/doc-1/verify')
        .expect(403);
    });
  });

  // ── GET /api/documents/:id/verification ────────────────────────────────────

  describe('GET /api/documents/:id/verification', () => {
    it('returns confirmed verification record', async () => {
      docs.findById.mockResolvedValueOnce(MOCK_DOC as any);
      verification.findLatestByDocument.mockResolvedValueOnce(MOCK_VERIFICATION as any);

      const res = await request(app.getHttpServer())
        .get('/api/documents/doc-1/verification')
        .expect(200);

      expect(res.body.stellarTxHash).toBe('tx123');
      expect(res.body.status).toBe(VerificationStatus.CONFIRMED);
    });

    it('returns pending verification record', async () => {
      docs.findById.mockResolvedValueOnce(MOCK_DOC as any);
      verification.findLatestByDocument.mockResolvedValueOnce(
        { ...MOCK_VERIFICATION, status: VerificationStatus.PENDING } as any,
      );

      const res = await request(app.getHttpServer())
        .get('/api/documents/doc-1/verification')
        .expect(200);

      expect(res.body.status).toBe(VerificationStatus.PENDING);
    });

    it('404 when no verification record found', async () => {
      docs.findById.mockResolvedValueOnce(MOCK_DOC as any);
      verification.findLatestByDocument.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get('/api/documents/doc-1/verification')
        .expect(404);
    });
  });
});
