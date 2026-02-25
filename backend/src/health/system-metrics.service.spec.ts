import { Test, TestingModule } from '@nestjs/testing';
import { SystemMetricsService } from './system-metrics.service';

describe('SystemMetricsService', () => {
  let service: SystemMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemMetricsService],
    }).compile();

    service = module.get<SystemMetricsService>(SystemMetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage in MB', () => {
      const result = service.getMemoryUsage();
      
      expect(result).toHaveProperty('heapUsed');
      expect(result).toHaveProperty('heapTotal');
      expect(result).toHaveProperty('rss');
      
      expect(typeof result.heapUsed).toBe('number');
      expect(typeof result.heapTotal).toBe('number');
      expect(typeof result.rss).toBe('number');
      
      expect(result.heapUsed).toBeGreaterThanOrEqual(0);
      expect(result.heapTotal).toBeGreaterThanOrEqual(0);
      expect(result.rss).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getUptime', () => {
    it('should return uptime in seconds', () => {
      const result = service.getUptime();
      
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDiskUsage', () => {
    it('should return disk usage information', () => {
      const result = service.getDiskUsage();
      
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('free');
      expect(result).toHaveProperty('used');
      expect(result).toHaveProperty('freePercent');
      
      expect(typeof result.total).toBe('number');
      expect(typeof result.free).toBe('number');
      expect(typeof result.used).toBe('number');
      expect(typeof result.freePercent).toBe('number');
      
      expect(result.total).toBeGreaterThan(0);
      expect(result.free).toBeGreaterThanOrEqual(0);
      expect(result.used).toBeGreaterThanOrEqual(0);
      expect(result.freePercent).toBeGreaterThanOrEqual(0);
      expect(result.freePercent).toBeLessThanOrEqual(100);
    });
  });

  describe('isDiskSpaceSufficient', () => {
    it('should return true when disk space is sufficient', () => {
      // Mock the disk usage to return sufficient space
      jest.spyOn(service, 'getDiskUsage').mockReturnValue({
        total: 10000,
        free: 1000,
        used: 9000,
        freePercent: 10,
      });
      
      const result = service.isDiskSpaceSufficient(500);
      expect(result).toBe(true);
    });

    it('should return false when disk space is insufficient', () => {
      // Mock the disk usage to return insufficient space
      jest.spyOn(service, 'getDiskUsage').mockReturnValue({
        total: 10000,
        free: 400,
        used: 9600,
        freePercent: 4,
      });
      
      const result = service.isDiskSpaceSufficient(500);
      expect(result).toBe(false);
    });

    it('should use default threshold of 500MB when not specified', () => {
      // Mock the disk usage to return exactly 500MB free
      jest.spyOn(service, 'getDiskUsage').mockReturnValue({
        total: 10000,
        free: 500,
        used: 9500,
        freePercent: 5,
      });
      
      const result = service.isDiskSpaceSufficient();
      expect(result).toBe(true);
    });
  });
});
