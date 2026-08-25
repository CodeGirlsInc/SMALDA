/**
 * E2E test suite — critical user journeys
 *
 * Requires real Postgres 16 + Redis 7 (matches the CI backend-e2e job).
 * External services (Stellar, Mail, Queue) are mocked so no network calls
 * are made during the test run.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  VersioningType,
  ValidationPipe,
} from '@nestjs/common';
import { DataSource } from '@nestjs/typeorm';
import * as request from 'supertest';
import { PDFDocument } from 'pdf-lib';

import { AppModule } from '../src/app.module';
import { StellarService } from '../src/stellar/stellar.service';
import { QueueService } from '../src/queue/queue.service';
import { MailService } from '../src/mail/mail.service';
import { DocumentProcessor } from '../src/queue/document.processor';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStellarService = {
  anchorHash: jest
    .fn()
    .mockResolvedValue({ txHash: 'mock-tx-hash', ledger: 12345 }),
  verifyHash: jest.fn().mockResolvedValue(true),
};

const mockQueueService = {
  enqueueAnalyze: jest.fn().mockResolvedValue({}),
  enqueueAnchor: jest.fn().mockResolvedValue({}),
  getConnectionOptions: jest
    .fn()
    .mockReturnValue({ host: 'localhost', port: 6379 }),
  onModuleDestroy: jest.fn(),
  queueName: 'document-processing',
};

const mockMailService = {
  sendWelcome: jest.fn().mockResolvedValue(undefined),
  sendVerificationComplete: jest.fn().mockResolvedValue(undefined),
  sendRiskAlert: jest.fn().mockResolvedValue(undefined),
};

const mockDocumentProcessor = {
  onModuleDestroy: jest.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let pdfCounter = 0;

async function createTestPdf(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  // Vary page size to produce unique file hashes
  pdfDoc.addPage([612 + (pdfCounter++ % 20), 792]);
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('App (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .overrideProvider(QueueService)
      .useValue(mockQueueService)
      .overrideProvider(MailService)
      .useValue(mockMailService)
      .overrideProvider(DocumentProcessor)
      .useValue(mockDocumentProcessor)
      .compile();

    app = moduleFixture.createNestApplication();

    // Mirror the production bootstrap (see main.ts)
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    // Truncate every table between tests for isolation
    const tables = [
      'activities',
      'access_logs',
      'disputes',
      'dispute_reasons',
      'verification_records',
      'documents',
      'users',
    ];
    for (const table of tables) {
      await dataSource.query(`TRUNCATE TABLE "${table}" CASCADE`);
    }

    // Clear mock call counts between tests
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Convenience wrapper — register a user and return the supertest response. */
  async function register(
    email: string,
    password: string,
    fullName: string,
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, fullName });
  }

  /** Convenience wrapper — login and return the supertest response. */
  async function login(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. Auth flow
  // ════════════════════════════════════════════════════════════════════════

  describe('Auth flow', () => {
    it('should register a new user and return an access_token', async () => {
      const res = await register('alice@test.com', 'password123', 'Alice');
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('access_token');
    });

    it('should login with valid credentials and return both tokens', async () => {
      await register('bob@test.com', 'secret456', 'Bob');
      const res = await login('bob@test.com', 'secret456');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
    });

    it('should reject duplicate email registration with 409', async () => {
      await register('dup@test.com', 'password123', 'First');
      const res = await register('dup@test.com', 'password123', 'Second');
      expect(res.status).toBe(409);
    });

    it('should reject login with wrong password with 401', async () => {
      await register('wrong@test.com', 'correct', 'User');
      const res = await login('wrong@test.com', 'incorrect');
      expect(res.status).toBe(401);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 2. Document journey: register → upload → list → get → risk → verify
  // ════════════════════════════════════════════════════════════════════════

  describe('Document journey', () => {
    let token: string;

    beforeEach(async () => {
      const reg = await register(
        'docuser@test.com',
        'password123',
        'Doc User',
      );
      token = reg.body.access_token;
    });

    it('should upload → list → get → risk-assess → verify', async () => {
      const pdfBuffer = await createTestPdf();

      // ── Upload ──────────────────────────────────────────────────────────
      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', pdfBuffer, {
          filename: 'land-title.pdf',
          contentType: 'application/pdf',
        });
      expect(uploadRes.status).toBe(202);
      const docId: string = uploadRes.body.id;
      expect(docId).toBeDefined();

      // ── List documents ──────────────────────────────────────────────────
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      // ── Get single document ─────────────────────────────────────────────
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/documents/${docId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(docId);

      // ── Risk assessment ─────────────────────────────────────────────────
      const riskRes = await request(app.getHttpServer())
        .get(`/api/v1/documents/${docId}/risk`)
        .set('Authorization', `Bearer ${token}`);
      expect(riskRes.status).toBe(200);
      expect(riskRes.body).toHaveProperty('score');
      expect(typeof riskRes.body.score).toBe('number');
      expect(riskRes.body).toHaveProperty('flags');
      expect(Array.isArray(riskRes.body.flags)).toBe(true);

      // ── Verify (queue) ──────────────────────────────────────────────────
      const verifyRes = await request(app.getHttpServer())
        .post(`/api/v1/documents/${docId}/verify`)
        .set('Authorization', `Bearer ${token}`);
      expect(verifyRes.status).toBe(202);
      expect(verifyRes.body.message).toBe('Verification queued');
      expect(mockQueueService.enqueueAnchor).toHaveBeenCalledWith(
        docId,
        expect.anything(),
      );
    });

    it('should return the existing document when uploading a duplicate hash', async () => {
      const pdfBuffer = await createTestPdf();

      const first = await request(app.getHttpServer())
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', pdfBuffer, {
          filename: 'doc-v1.pdf',
          contentType: 'application/pdf',
        });
      expect(first.status).toBe(202);

      // Upload the exact same bytes again
      const second = await request(app.getHttpServer())
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', pdfBuffer, {
          filename: 'doc-v2.pdf',
          contentType: 'application/pdf',
        });
      expect(second.status).toBe(200);
      expect(second.body.id).toBe(first.body.id);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 3. Authorization — cross-user isolation
  // ════════════════════════════════════════════════════════════════════════

  describe('Authorization', () => {
    let tokenA: string;
    let tokenB: string;
    let docIdA: string;

    beforeEach(async () => {
      const regA = await register('usera@test.com', 'password123', 'User A');
      tokenA = regA.body.access_token;

      const regB = await register('userb@test.com', 'password123', 'User B');
      tokenB = regB.body.access_token;

      // User A uploads a document
      const pdfBuffer = await createTestPdf();
      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', pdfBuffer, {
          filename: 'user-a-doc.pdf',
          contentType: 'application/pdf',
        });
      docIdA = uploadRes.body.id;
    });

    it('should prevent User B from reading User A\'s document (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${docIdA}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(403);
    });

    it('should only return User B\'s own documents', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return only User B\'s own disputes', async () => {
      // File a dispute as User A
      await request(app.getHttpServer())
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ documentId: docIdA, description: 'Ownership dispute test' });

      // User B should see no disputes
      const res = await request(app.getHttpServer())
        .get('/api/v1/disputes')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should reject unauthenticated requests to protected endpoints (401)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/documents');
      expect(res.status).toBe(401);
    });

    it('should reject regular user from admin access-logs endpoint (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/access-logs')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated request to admin access-logs (401)', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/admin/access-logs',
      );
      expect(res.status).toBe(401);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 4. Public verification path (no authentication)
  // ════════════════════════════════════════════════════════════════════════

  describe('Public verification', () => {
    it('should return verified: false for an unknown hash', async () => {
      const hash = 'a'.repeat(64); // valid SHA-256 format, unknown
      const res = await request(app.getHttpServer()).get(
        `/api/v1/verify/${hash}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        verified: false,
        message: 'Document not found',
      });
    });

    it('should reject an invalid hash format with 400', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/verify/not-a-hash',
      );
      expect(res.status).toBe(400);
    });

    it('should reject a hash that is too short', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/verify/abc123',
      );
      expect(res.status).toBe(400);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 5. Health check
  // ════════════════════════════════════════════════════════════════════════

  describe('Health check', () => {
    it('should return a health status object', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');
      // Status may be 200 (ok) or 503 (degraded) depending on infra;
      // the important thing is that the endpoint responds.
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(['ok', 'error']).toContain(res.body.status);
    });
  });
});
