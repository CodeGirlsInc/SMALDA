import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { QueueService } from '../queue/queue.service';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller('metrics')
@UseGuards(MetricsAuthGuard)
export class MetricsController {
  constructor(
    private readonly queueService: QueueService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Expose Prometheus metrics' })
  async getMetrics(): Promise<string> {
    const counts = await this.queueService
      .getQueue()
      .getJobCounts('waiting', 'active', 'delayed', 'failed');
    this.metricsService.setQueueDepth(counts as Record<string, number>);
    return this.metricsService.getMetrics();
  }
}
