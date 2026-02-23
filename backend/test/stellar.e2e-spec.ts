import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Stellar API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/stellar/accounts (POST)', () => {
    it('should create a new Stellar account', () => {
      return request(app.getHttpServer())
        .post('/stellar/accounts')
        .send({
          network: 'testnet',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('publicKey');
          expect(res.body).toHaveProperty('secretKey');
          expect(res.body.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
          expect(res.body.secretKey).toMatch(/^S[A-Z0-9]{55}$/);
        });
    });

    it('should validate network parameter', () => {
      return request(app.getHttpServer())
        .post('/stellar/accounts')
        .send({
          network: 'invalid',
        })
        .expect(400);
    });
  });

  describe('/stellar/estimate-fee (POST)', () => {
    it('should estimate transaction fee', () => {
      const validPublicKey = 'G' + 'A'.repeat(55);
      const validHash = 'a'.repeat(64);

      return request(app.getHttpServer())
        .post('/stellar/estimate-fee')
        .send({
          sourcePublicKey: validPublicKey,
          documentHash: validHash,
          network: 'testnet',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('fee');
          expect(res.body).toHaveProperty('cost');
          expect(typeof res.body.fee).toBe('number');
          expect(typeof res.body.cost).toBe('string');
        });
    });

    it('should validate public key format', () => {
      return request(app.getHttpServer())
        .post('/stellar/estimate-fee')
        .send({
          sourcePublicKey: 'invalid-key',
          documentHash: 'a'.repeat(64),
        })
        .expect(400);
    });

    it('should validate document hash format', () => {
      return request(app.getHttpServer())
        .post('/stellar/estimate-fee')
        .send({
          sourcePublicKey: 'G' + 'A'.repeat(55),
          documentHash: 'invalid-hash',
        })
        .expect(400);
    });
  });

  describe('/stellar/verify (POST)', () => {
    it('should verify document on Stellar', () => {
      return request(app.getHttpServer())
        .post('/stellar/verify')
        .send({
          documentHash: 'a'.repeat(64),
          network: 'testnet',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('verified');
          expect(typeof res.body.verified).toBe('boolean');
        });
    });
  });

  describe('/stellar/accounts/:publicKey/balance (GET)', () => {
    it('should get account balance', () => {
      const validPublicKey = 'G' + 'A'.repeat(55);

      return request(app.getHttpServer())
        .get(`/stellar/accounts/${validPublicKey}/balance`)
        .query({ network: 'testnet' })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('balance');
        });
    });

    it('should validate public key format', () => {
      return request(app.getHttpServer())
        .get('/stellar/accounts/invalid-key/balance')
        .expect(400);
    });
  });
});
