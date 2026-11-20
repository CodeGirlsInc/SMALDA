import { Injectable } from '@nestjs/common';
import { Counter, Gauge, register } from 'prom-client';

/**
 * Owns the application metrics so they are registered once and incremented
 * by the code paths that represent real events (uploads and anchor jobs),
 * not by the metrics scrape itself.
 */
@Injectable()
export class MetricsService {
  private readonly documentsSubmitted: Counter;
  private readonly verificationsTotal: Counter;
  private readonly queueDepth: Gauge;

  constructor() {
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

  incDocumentsSubmitted(): void {
    this.documentsSubmitted.inc(1);
  }

  incVerificationsTotal(): void {
    this.verificationsTotal.inc(1);
  }

  setQueueDepth(counts: Record<string, number>): void {
    this.queueDepth.reset();
    for (const [state, value] of Object.entries(counts)) {
      this.queueDepth.labels(state).set(Number(value));
    }
  }

  getMetrics(): Promise<string> {
    return Promise.resolve(register.metrics());
  }
}
