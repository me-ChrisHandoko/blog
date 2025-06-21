// src/common/interceptors/logging.interceptor.ts - SAFE VERSION
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const { method, url } = request;
    const userAgent = request.headers['user-agent'] || '';
    const ip = request.ip || 'unknown';
    const start = Date.now();

    // Log incoming request (only in development)
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`→ ${method} ${url} - ${ip}`);
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const statusCode = response.statusCode;

        // Log based on environment
        if (process.env.NODE_ENV === 'development') {
          this.logger.log(`← ${method} ${url} ${statusCode} - ${duration}ms`);
        } else if (duration > 1000) {
          // Only log slow requests in production
          this.logger.warn(`Slow request: ${method} ${url} - ${duration}ms`);
        }
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        const statusCode = error.status || 500;

        // Always log errors
        this.logger.error(
          `✗ ${method} ${url} ${statusCode} - ${duration}ms - ${error.message}`,
        );

        return throwError(() => error);
      }),
    );
  }
}
