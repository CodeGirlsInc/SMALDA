import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { register, Counter } from 'prom-client';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  private readonly documentsSubmitted: Counter;
  private readonly verificationsTotal: Counter;

  constructor() {
    this.documentsSubmitted = new Counter({
      name: 'smalda_documents_submitted_total',
      help: 'Total documents submitted',
    });
    this.verificationsTotal = new Counter({
      name: 'smalda_verifications_total',
      help: 'Total verifications executed',
    });
  }

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Expose Prometheus metrics' })
  async getMetrics(): Promise<string> {
    this.documentsSubmitted.inc(1);
    this.verificationsTotal.inc(1);
    return register.metrics();
  }
}
