// src/bootstrap/middleware-setup.ts
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  ValidationPipe,
  Logger,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { FastifyRequest, FastifyReply } from 'fastify';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { I18nExceptionFilter } from '../common/filters/i18n-exception.filter';
import { LanguageService } from '../i18n/services/language.service';
import { LanguageGuard } from '../i18n/guards/language.guard';
import { ErrorResponseInterceptor } from '../common/interceptors/error-response.interceptor';
import { EnvConfig } from '../config/env.utils';

@Injectable()
class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const { method, url } = request;
    const start = Date.now();

    if (EnvConfig.isDevelopment()) {
      const userAgent = request.headers['user-agent'] || '';
      const ip = request.ip || 'unknown';
      this.logger.log(`→ ${method} ${url} - ${ip}`);
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const statusCode = response.statusCode;

        if (EnvConfig.isDevelopment()) {
          this.logger.log(`← ${method} ${url} ${statusCode} - ${duration}ms`);
        } else if (duration > 2000) {
          this.logger.warn(`Slow request: ${method} ${url} - ${duration}ms`);
        }
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        const statusCode = error.status || 500;

        this.logger.error(
          `✗ ${method} ${url} ${statusCode} - ${duration}ms - ${error.message}`,
        );

        return throwError(() => error);
      }),
    );
  }
}

export class MiddlewareSetup {
  private static readonly logger = new Logger('MiddlewareSetup');

  static configure(
    app: NestFastifyApplication,
    reflector: Reflector,
    languageService: LanguageService,
  ): void {
    try {
      this.configureInterceptors(app, languageService);
      this.configureValidationPipe(app);
      this.configureGlobalGuards(app, reflector, languageService);
      this.configureGlobalFilters(app, languageService);

      this.logger.log('✅ Middleware configuration completed');
    } catch (error) {
      this.logger.error('❌ Middleware configuration failed:', error);
      throw error;
    }
  }

  private static configureInterceptors(
    app: NestFastifyApplication,
    languageService: LanguageService,
  ): void {
    app.useGlobalInterceptors(
      new RequestLoggingInterceptor(),
      new ErrorResponseInterceptor(languageService),
    );

    this.logger.debug('🔍 Global interceptors configured');
  }

  private static configureValidationPipe(app: NestFastifyApplication): void {
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: {
          enableImplicitConversion: false,
        },
        skipMissingProperties: EnvConfig.isProduction(),
        disableErrorMessages: EnvConfig.isProduction(),
        stopAtFirstError: true,
      }),
    );

    this.logger.debug('✅ Global validation pipe configured');
  }

  private static configureGlobalGuards(
    app: NestFastifyApplication,
    reflector: Reflector,
    languageService: LanguageService,
  ): void {
    app.useGlobalGuards(
      new LanguageGuard(languageService),
      new JwtAuthGuard(reflector),
    );

    this.logger.debug('🛡️ Global guards configured (Language → JWT)');
  }

  private static configureGlobalFilters(
    app: NestFastifyApplication,
    languageService: LanguageService,
  ): void {
    app.useGlobalFilters(new I18nExceptionFilter(languageService));

    this.logger.debug('🔧 Global exception filters configured');
  }
}
