import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { register } from 'prom-client';

import { MetricsController } from './metrics.controller';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { MetricsService } from './metrics.service';

const mockMetricsService = {
  setQueueDepth: jest.fn(),
  getMetrics: jest.fn().mockResolvedValue('smalda_queue_depth{state="waiting"} 0'),
};

const mockQueueService = {
  getQueue: jest.fn().mockReturnValue({
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 1,
      active: 2,
      delayed: 0,
      failed: 3,
    }),
  }),
};

function contextWithHeader(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(() => {
    register.clear();
    jest.clearAllMocks();
    controller = new MetricsController(
      mockQueueService as any,
      mockMetricsService as any,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should not increment document or verification counters when scraped', async () => {
    mockMetricsService.getMetrics.mockResolvedValue('stable output');

    const first = await controller.getMetrics();
    const second = await controller.getMetrics();

    expect(first).toBe('stable output');
    expect(second).toBe('stable output');
    expect(mockMetricsService.setQueueDepth).toHaveBeenCalledTimes(2);
  });

  it('should publish the current queue depth without mutating counters', async () => {
    await controller.getMetrics();

    expect(mockMetricsService.setQueueDepth).toHaveBeenCalledWith({
      waiting: 1,
      active: 2,
      delayed: 0,
      failed: 3,
    });
  });
});

describe('MetricsAuthGuard', () => {
  const originalToken = process.env.METRICS_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.METRICS_TOKEN;
    } else {
      process.env.METRICS_TOKEN = originalToken;
    }
  });

  it('returns 401 when no token is configured', () => {
    delete process.env.METRICS_TOKEN;
    expect(() =>
      new MetricsAuthGuard().canActivate(
        contextWithHeader('Bearer anything'),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('returns 401 when the bearer token is missing', () => {
    process.env.METRICS_TOKEN = 's3cret';
    expect(() => new MetricsAuthGuard().canActivate(contextWithHeader())).toThrow(
      UnauthorizedException,
    );
  });

  it('returns 401 when the bearer token is wrong', () => {
    process.env.METRICS_TOKEN = 's3cret';
    expect(() =>
      new MetricsAuthGuard().canActivate(contextWithHeader('Bearer wrong')),
    ).toThrow(UnauthorizedException);
  });

  it('allows a matching bearer token', () => {
    process.env.METRICS_TOKEN = 's3cret';
    expect(
      new MetricsAuthGuard().canActivate(
        contextWithHeader('Bearer s3cret'),
      ),
    ).toBe(true);
  });
});
