import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

describe('Documents Integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const mockQueue = {
    add: jest.fn(),
  };

  const mockStellarService = {
    createAnchorJob: jest.fn().mockResolvedValue({
      jobId: 'stellar-job-123',
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('DOCUMENT_QUEUE')
        .useValue(mockQueue)
        .overrideProvider('StellarService')
        .useValue(mockStellarService)
        .compile();

    app = moduleFixture.createNestApplication();

    await app.init();

    dataSource = moduleFixture.get(DataSource);
  });

  afterEach(async () => {
    await dataSource.query(`DELETE FROM documents`);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('uploads document successfully', async () => {
    const response = await request(app.getHttpServer())
      .post('/documents/upload')
      .attach(
        'file',
        Buffer.from('valid file content'),
        {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        },
      )
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toBe('PENDING');
  });

  it('rejects invalid MIME type', async () => {
    await request(app.getHttpServer())
      .post('/documents/upload')
      .attach(
        'file',
        Buffer.from('invalid content'),
        {
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
        },
      )
      .expect(400);
  });

  it('rejects file exceeding 20MB', async () => {
    const oversizedBuffer = Buffer.alloc(21 * 1024 * 1024);

    await request(app.getHttpServer())
      .post('/documents/upload')
      .attach(
        'file',
        oversizedBuffer,
        {
          filename: 'large.pdf',
          contentType: 'application/pdf',
        },
      )
      .expect(400);
  });

  it('rejects duplicate document hash', async () => {
    const fileBuffer = Buffer.from('duplicate file');

    await request(app.getHttpServer())
      .post('/documents/upload')
      .attach(
        'file',
        fileBuffer,
        {
          filename: 'doc1.pdf',
          contentType: 'application/pdf',
        },
      )
      .expect(201);

    await request(app.getHttpServer())
      .post('/documents/upload')
      .attach(
        'file',
        fileBuffer,
        {
          filename: 'doc2.pdf',
          contentType: 'application/pdf',
        },
      )
      .expect(409);
  });

  it('handles status transitions from PENDING → ANALYZING → VERIFIED', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post('/documents/upload')
      .attach(
        'file',
        Buffer.from('verification document'),
        {
          filename: 'verify.pdf',
          contentType: 'application/pdf',
        },
      );

    const documentId = uploadResponse.body.id;

    await request(app.getHttpServer())
      .patch(`/documents/${documentId}/status`)
      .send({
        status: 'ANALYZING',
      })
      .expect(200);

    const verifiedResponse = await request(app.getHttpServer())
      .patch(`/documents/${documentId}/status`)
      .send({
        status: 'VERIFIED',
      })
      .expect(200);

    expect(verifiedResponse.body.status).toBe('VERIFIED');
  });

  it('verification endpoint triggers Stellar anchor job', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post('/documents/upload')
      .attach(
        'file',
        Buffer.from('stellar verification'),
        {
          filename: 'stellar.pdf',
          contentType: 'application/pdf',
        },
      );

    const documentId = uploadResponse.body.id;

    await request(app.getHttpServer())
      .post(`/documents/${documentId}/verify`)
      .expect(200);

    expect(
      mockStellarService.createAnchorJob,
    ).toHaveBeenCalled();

    expect(mockQueue.add).toHaveBeenCalled();
  });
});