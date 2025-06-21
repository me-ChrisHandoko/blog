import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Timeout');
  private readonly timeoutDuration = 30000; // 30 seconds

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const { method, url } = request;

    return next.handle().pipe(
      timeout(this.timeoutDuration),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          this.logger.error(
            `⏰ Request timeout: ${method} ${url} exceeded ${this.timeoutDuration}ms`,
          );
          return throwError(
            () => new RequestTimeoutException('Request timeout'),
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
