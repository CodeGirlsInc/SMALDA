import { MetricsController } from './metrics.controller';
import { register } from 'prom-client';

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(() => {
    register.clear();
    controller = new MetricsController();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('increments counters on each request', async () => {
    let metrics = await controller.getMetrics();
    expect(metrics).toContain('smalda_documents_submitted_total 1');
    expect(metrics).toContain('smalda_verifications_total 1');

    metrics = await controller.getMetrics();
    expect(metrics).toContain('smalda_documents_submitted_total 2');
    expect(metrics).toContain('smalda_verifications_total 2');
  });

  it('produces valid Prometheus output under concurrent requests', async () => {
    const promises = Array.from({ length: 10 }, () => controller.getMetrics());
    const results = await Promise.all(promises);
    results.forEach((metrics) => {
      expect(metrics).toMatch(
        /^# HELP smalda_documents_submitted_total Total documents submitted\n# TYPE smalda_documents_submitted_total counter\nsmalda_documents_submitted_total \d+\n# HELP smalda_verifications_total Total verifications executed\n# TYPE smalda_verifications_total counter\nsmalda_verifications_total \d+$/,
      );
    });
  });
});
