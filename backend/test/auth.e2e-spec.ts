import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';

import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const testEmail = `e2e-${Date.now()}@example.com`;
  const testPassword = 'StrongPass123!';
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('201 — registers a new user and returns access_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword, fullName: 'E2E Test User' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('access_token');
    });

    it('409 — duplicate email returns conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword, fullName: 'E2E Test User' });

      expect(res.status).toBe(409);
    });

    it('400 — invalid payload (missing email)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ password: testPassword, fullName: 'E2E Test User' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('200 — returns access_token and refresh_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
      refreshToken = res.body.refresh_token;
    });

    it('401 — wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('401 — unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: testPassword });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('200 — returns new access_token with valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
    });

    it('401 — expired refresh token', async () => {
      const expiredToken = jwt.sign({ sub: 'user-id' }, 'secret', { expiresIn: -1 });
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: expiredToken });

      expect(res.status).toBe(401);
    });

    it('401 — tampered refresh token', async () => {
      const tampered = refreshToken.slice(0, -5) + 'XXXXX';
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: tampered });

      expect(res.status).toBe(401);
    });
  });

  describe('Protected endpoints', () => {
    it('401 — no token provided', async () => {
      const res = await request(app.getHttpServer()).get('/api/documents');
      expect(res.status).toBe(401);
    });

    it('401 — expired access token', async () => {
      const expiredToken = jwt.sign(
        { sub: 'user-id', email: 'x@x.com', role: 'user' },
        'wrong-secret',
        { expiresIn: -1 },
      );
      const res = await request(app.getHttpServer())
        .get('/api/documents')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });
  });
});
