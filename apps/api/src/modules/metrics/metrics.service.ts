import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics registry. Exposes Node/process defaults plus HTTP request
 * counters and a latency histogram, recorded by MetricsInterceptor. Scraped at
 * GET /metrics.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpRequests: Counter<string>;
  readonly httpDuration: Histogram<string>;

  constructor() {
    this.registry.setDefaultLabels({ app: 'ccp-api' });
    collectDefaultMetrics({ register: this.registry });

    this.httpRequests = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
  }

  observe(method: string, route: string, status: number, seconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, seconds);
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
