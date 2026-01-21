import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  let userEmail: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      userEmail = `test${Date.now()}@example.com`;
      
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: userEmail,
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('message');
    });

    it('should fail with duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: userEmail,
          password: 'Password123!',
        })
        .expect(409);
    });

    it('should fail with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
        })
        .expect(400);
    });

    it('should fail with weak password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test2@example.com',
          password: 'weak',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should fail login without email verification', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: userEmail,
          password: 'Password123!',
        })
        .expect(401);
    });

    it('should fail with invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: userEmail,
          password: 'WrongPassword',
        })
        .expect(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({
          email: userEmail,
        })
        .expect(201);

      expect(response.body).toHaveProperty('message');
    });

    it('should not reveal if email exists', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(201);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should fail with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on registration', async () => {
      const email = `ratelimit${Date.now()}@example.com`;
      
      // Make multiple requests quickly
      for (let i = 0; i < 6; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: `${i}${email}`,
            password: 'Password123!',
          });
        
        if (i >= 5) {
          expect(response.status).toBe(429);
        }
      }
    });
  });
});

describe('Users E2E Tests', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/users/profile', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/users/profile')
        .expect(401);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .put('/api/users/profile')
        .send({
          firstName: 'Updated',
        })
        .expect(401);
    });
  });

  describe('GET /api/users', () => {
    it('should require admin role', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .expect(401);
    });
  });
});
