import { Controller, Get, Header } from '@nestjs/common';

const counters: Record<string, number> = {};
const histograms: Record<string, number[]> = {};

export function incCounter(name: string, labels?: string) {
  const key = labels ? `${name}:${labels}` : name;
  counters[key] = (counters[key] || 0) + 1;
}

export function observeHistogram(name: string, value: number) {
  if (!histograms[name]) histograms[name] = [];
  histograms[name].push(value);
}

@Controller()
export class MetricsController {
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string {
    const lines: string[] = [];

    lines.push('# HELP smalda_http_requests_total Total HTTP requests');
    lines.push('# TYPE smalda_http_requests_total counter');
    for (const [key, value] of Object.entries(counters)) {
      if (key.startsWith('http_')) {
        lines.push(`${key} ${value}`);
      }
    }

    lines.push('');
    lines.push('# HELP smalda_domain_events_total Domain events');
    lines.push('# TYPE smalda_domain_events_total counter');
    for (const [key, value] of Object.entries(counters)) {
      if (key.startsWith('domain_')) {
        lines.push(`${key} ${value}`);
      }
    }

    lines.push('');
    lines.push('# HELP smalda_queue_depth Queue depth');
    lines.push('# TYPE smalda_queue_depth gauge');
    for (const [key, value] of Object.entries(counters)) {
      if (key.startsWith('queue_')) {
        lines.push(`${key} ${value}`);
      }
    }

    lines.push('');
    return lines.join('\n') + '\n';
  }
}
