import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { register, Counter, Gauge } from 'prom-client';
import { QueueService } from '../queue/queue.service';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  private readonly documentsSubmitted: Counter;
  private readonly verificationsTotal: Counter;
  private readonly queueDepth: Gauge;

  constructor(private readonly queueService: QueueService) {
    this.documentsSubmitted = new Counter({
      name: 'smalda_documents_submitted_total',
      help: 'Total documents submitted',
    });
    this.verificationsTotal = new Counter({
      name: 'smalda_verifications_total',
      help: 'Total verifications executed',
    });
    this.queueDepth = new Gauge({
      name: 'smalda_queue_depth',
      help: 'Current job counts by state in the document-processing queue',
      labelNames: ['state'],
    });
  }

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Expose Prometheus metrics' })
  async getMetrics(): Promise<string> {
    this.documentsSubmitted.inc(1);
    this.verificationsTotal.inc(1);
    const counts = await this.queueService
      .getQueue()
      .getJobCounts('waiting', 'active', 'delayed', 'failed');
    this.queueDepth.reset();
    for (const [state, value] of Object.entries(counts)) {
      this.queueDepth.labels(state).set(Number(value));
    }
    return register.metrics();
  }
}
