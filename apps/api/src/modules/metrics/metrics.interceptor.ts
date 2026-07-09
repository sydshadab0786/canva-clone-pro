import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/** Records request count + latency for every HTTP request. */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();

    // Prefer the route pattern (/projects/:id) over the concrete URL to keep
    // label cardinality bounded.
    const route = (req.route?.path as string | undefined) ?? req.path;

    return next.handle().pipe(
      finalize(() => {
        const seconds = Number(process.hrtime.bigint() - start) / 1e9;
        this.metrics.observe(req.method, route, res.statusCode, seconds);
      }),
    );
  }
}
