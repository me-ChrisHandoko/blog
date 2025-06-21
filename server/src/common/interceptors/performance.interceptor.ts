import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  private readonly slowThreshold = 1000; // 1 second
  private readonly verySlowThreshold = 5000; // 5 seconds

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const { method, url } = request;
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

        // Log performance warnings
        if (duration > this.verySlowThreshold) {
          this.logger.error(
            `🔥 Very slow request: ${method} ${url} took ${duration.toFixed(2)}ms`,
          );
        } else if (duration > this.slowThreshold) {
          this.logger.warn(
            `🐌 Slow request: ${method} ${url} took ${duration.toFixed(2)}ms`,
          );
        }

        // Detailed logging for development
        if (process.env.NODE_ENV === 'development' && duration > 100) {
          this.logger.debug(`⚡ ${method} ${url} - ${duration.toFixed(2)}ms`);
        }
      }),
    );
  }
}
