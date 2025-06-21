import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    // Generate or use existing request ID
    const requestId =
      (request.headers['x-request-id'] as string) || randomUUID();

    // Add request ID to request object for later use
    (request as any).requestId = requestId;

    // Add request ID to response headers
    response.header('x-request-id', requestId);

    return next.handle();
  }
}
