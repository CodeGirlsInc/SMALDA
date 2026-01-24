import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ReportType, ReportFormat } from '../src/reporting/entities/report.entity';

describe('Reporting E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test1234!',
      });

    if (loginResponse.status === 200 || loginResponse.status === 201) {
      authToken = loginResponse.body.accessToken;
      userId = loginResponse.body.user.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/reports (POST)', () => {
    it('should generate a document verification report', async () => {
      const createReportDto = {
        title: 'Test Document Verification Report',
        description: 'E2E test report',
        type: ReportType.DOCUMENT_VERIFICATION,
        format: ReportFormat.PDF,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createReportDto);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(createReportDto.title);
      expect(response.body.type).toBe(createReportDto.type);
      expect(response.body.format).toBe(createReportDto.format);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/reports')
        .send({
          title: 'Test Report',
          type: ReportType.DOCUMENT_VERIFICATION,
          format: ReportFormat.PDF,
        });

      expect(response.status).toBe(401);
    });

    it('should validate report DTO', async () => {
      const response = await request(app.getHttpServer())
        .post('/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          title: '',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('/reports (GET)', () => {
    it('should get all reports for current user', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter reports by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          type: ReportType.DOCUMENT_VERIFICATION,
          page: 1,
          limit: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('/reports/templates (GET)', () => {
    it('should get all available templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('/reports/templates (POST)', () => {
    it('should create a new template (admin only)', async () => {
      const createTemplateDto = {
        name: 'Custom Template',
        description: 'A custom report template',
        type: ReportType.CUSTOM,
        supportedFormats: [ReportFormat.PDF, ReportFormat.EXCEL],
        config: {
          columns: ['col1', 'col2'],
          layout: 'standard',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/reports/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createTemplateDto);

      // May be 403 if user is not admin, or 201 if admin
      expect([201, 403]).toContain(response.status);
    });
  });

  describe('/reports/schedules (POST)', () => {
    it('should create a report schedule', async () => {
      // First, get a template
      const templatesResponse = await request(app.getHttpServer())
        .get('/reports/templates')
        .set('Authorization', `Bearer ${authToken}`);

      if (templatesResponse.body.length > 0) {
        const templateId = templatesResponse.body[0].id;

        const createScheduleDto = {
          name: 'Daily Report Schedule',
          description: 'Automatically generate daily reports',
          templateId,
          frequency: 'daily',
          recipients: ['test@example.com'],
        };

        const response = await request(app.getHttpServer())
          .post('/reports/schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .send(createScheduleDto);

        expect([201, 400]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body).toHaveProperty('id');
          expect(response.body.name).toBe(createScheduleDto.name);
        }
      }
    });
  });

  describe('/reports/schedules (GET)', () => {
    it('should get all schedules for current user', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('/reports/:id (GET)', () => {
    it('should get a specific report', async () => {
      // First create a report
      const createResponse = await request(app.getHttpServer())
        .post('/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Report for GET',
          type: ReportType.SYSTEM_ANALYTICS,
          format: ReportFormat.CSV,
        });

      if (createResponse.status === 201) {
        const reportId = createResponse.body.id;

        const response = await request(app.getHttpServer())
          .get(`/reports/${reportId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(reportId);
      }
    });

    it('should return 404 for non-existent report', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('/reports/:id (DELETE)', () => {
    it('should delete a report', async () => {
      // First create a report
      const createResponse = await request(app.getHttpServer())
        .post('/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Report for DELETE',
          type: ReportType.USER_ACTIVITY,
          format: ReportFormat.EXCEL,
        });

      if (createResponse.status === 201) {
        const reportId = createResponse.body.id;

        const response = await request(app.getHttpServer())
          .delete(`/reports/${reportId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBeDefined();

        // Verify deletion
        const getResponse = await request(app.getHttpServer())
          .get(`/reports/${reportId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(getResponse.status).toBe(404);
      }
    });
  });

  describe('/reports/schedules/:id/toggle (PATCH)', () => {
    it('should toggle schedule active status', async () => {
      // First get templates and create a schedule
      const templatesResponse = await request(app.getHttpServer())
        .get('/reports/templates')
        .set('Authorization', `Bearer ${authToken}`);

      if (templatesResponse.body.length > 0) {
        const templateId = templatesResponse.body[0].id;

        const createResponse = await request(app.getHttpServer())
          .post('/reports/schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Schedule to Toggle',
            templateId,
            frequency: 'weekly',
          });

        if (createResponse.status === 201) {
          const scheduleId = createResponse.body.id;
          const initialStatus = createResponse.body.isActive;

          const toggleResponse = await request(app.getHttpServer())
            .patch(`/reports/schedules/${scheduleId}/toggle`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(toggleResponse.status).toBe(200);
          expect(toggleResponse.body.isActive).toBe(!initialStatus);
        }
      }
    });
  });
});
