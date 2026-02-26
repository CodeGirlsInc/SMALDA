import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { 
  HealthCheck, 
  HealthCheckService, 
  TypeOrmHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { SystemMetricsService } from './system-metrics.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
    private systemMetrics: SystemMetricsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' }
      }
    }
  })
  getLiveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is ready to accept traffic',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: { type: 'object' },
        details: { type: 'object' }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service is not ready',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        error: { type: 'object' },
        details: { type: 'object' }
      }
    }
  })
  async getReadiness() {
    return this.health.check([
      async () => this.db.pingCheck('database'),
      async () => this.disk.checkStorage('storage', {
        path: process.env.UPLOAD_PATH || './uploads',
        thresholdPercent: 95, // Warn if less than 5% free
      }),
    ]);
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed system health information' })
  @ApiResponse({ 
    status: 200, 
    description: 'Detailed system status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-02-25T22:30:00.000Z' },
        uptime: { type: 'number', example: 3600 },
        memory: { 
          type: 'object',
          properties: {
            heapUsed: { type: 'number', example: 128 },
            heapTotal: { type: 'number', example: 256 },
            rss: { type: 'number', example: 180 }
          }
        },
        disk: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 10000 },
            free: { type: 'number', example: 5000 },
            used: { type: 'number', example: 5000 },
            freePercent: { type: 'number', example: 50 }
          }
        },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'up' },
            responseTime: { type: 'number', example: 12 }
          }
        }
      }
    }
  })
  async getDetailedHealth() {
    const startTime = Date.now();
    
    // Check database connectivity and measure response time
    let dbStatus = 'down';
    let dbResponseTime = 0;
    
    try {
      await this.db.pingCheck('database');
      dbStatus = 'up';
      dbResponseTime = Date.now() - startTime;
    } catch (error) {
      dbStatus = 'down';
      dbResponseTime = Date.now() - startTime;
    }

    const memoryUsage = this.systemMetrics.getMemoryUsage();
    const diskUsage = this.systemMetrics.getDiskUsage();
    const uptime = this.systemMetrics.getUptime();
    
    // Determine overall status
    const isHealthy = dbStatus === 'up' && this.systemMetrics.isDiskSpaceSufficient();
    
    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime,
      memory: memoryUsage,
      disk: diskUsage,
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
      },
    };
  }
}
