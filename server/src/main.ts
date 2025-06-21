// src/main.ts - FIXED VERSION (Remove complex imports)
import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { I18nExceptionFilter } from './common/filters/i18n-exception.filter';
import { LanguageService } from './i18n/services/language.service';
import { LanguageGuard } from './i18n/guards/language.guard';
import { EnvConfig } from './config/env.utils';
import { EnvironmentVariables } from './config/env.validation';
import { ErrorResponseInterceptor } from './common/interceptors/error-response.interceptor';

// ✅ FIXED: Simple interceptor creation without complex imports
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { FastifyRequest, FastifyReply } from 'fastify';

// ✅ Simple Logging Interceptor (inline definition)
@Injectable()
class SimpleLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const { method, url } = request;
    const userAgent = request.headers['user-agent'] || '';
    const ip = request.ip || 'unknown';
    const start = Date.now();

    // Log incoming request
    this.logger.log(`→ ${method} ${url} - ${ip}`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const statusCode = response.statusCode;

        // Log successful response
        this.logger.log(`← ${method} ${url} ${statusCode} - ${duration}ms`);
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        const statusCode = error.status || 500;

        // Log error response
        this.logger.error(
          `✗ ${method} ${url} ${statusCode} - ${duration}ms - ${error.message}`,
        );

        return throwError(() => error);
      }),
    );
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    // Create NestJS app with basic Fastify adapter first
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: false,
        trustProxy: true,
        disableRequestLogging: true,
      }),
    );

    // Initialize EnvConfig AFTER app creation
    const configService =
      app.get<ConfigService<EnvironmentVariables>>(ConfigService);
    EnvConfig.initialize(configService);

    // NOW we can safely use EnvConfig
    const nodeEnv = EnvConfig.NODE_ENV;
    const port = EnvConfig.PORT;
    const allowedOrigins = EnvConfig.ALLOWED_ORIGINS;

    logger.log(`🚀 Starting application in ${nodeEnv} mode`);

    // Get services
    const reflector = app.get(Reflector);
    const languageService = app.get(LanguageService);

    try {
      // Security headers
      await app.register(require('@fastify/helmet'), {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: [`'self'`],
            styleSrc: [`'self'`, `'unsafe-inline'`],
            scriptSrc: [`'self'`],
            imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
          },
        },
      });

      // CORS configuration
      await app.register(require('@fastify/cors'), {
        origin: allowedOrigins,
        credentials: true,
      });

      // Compression
      await app.register(require('@fastify/compress'));

      // Rate limiting (only in production)
      if (EnvConfig.isProduction()) {
        await app.register(require('@fastify/rate-limit'), {
          max: EnvConfig.RATE_LIMIT_MAX,
          timeWindow: EnvConfig.RATE_LIMIT_TTL,
          keyGenerator: (request) => {
            return (
              request.user?.id ||
              request.headers['x-forwarded-for'] ||
              request.ip
            );
          },
          errorResponseBuilder: (request, context) => ({
            error: 'Too Many Requests',
            statusCode: 429,
            retryAfter: Math.round(context.ttl / 1000),
          }),
        });
        logger.log('⚡ Rate limiting enabled for production');
      }

      logger.log('✅ Fastify plugins registered successfully');
    } catch (error) {
      logger.error('❌ Error registering Fastify plugins:', error);
      throw error;
    }

    // ✅ FIXED: Simple interceptor usage (no complex imports)
    app.useGlobalInterceptors(
      new SimpleLoggingInterceptor(),
      new ErrorResponseInterceptor(languageService),
    );

    // Global validation pipe
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
      }),
    );

    // Global guards - Order matters!
    app.useGlobalGuards(
      new LanguageGuard(languageService), // First: Detect language
      new JwtAuthGuard(reflector), // Then: Authenticate
    );

    // Global filters
    app.useGlobalFilters(new I18nExceptionFilter(languageService));

    // Start server
    const host = EnvConfig.isProduction() ? '0.0.0.0' : 'localhost';

    await app.listen(port, host);

    // Enhanced startup logging
    logger.log(`🚀 Application running on: http://${host}:${port}`);
    logger.log(`🔐 Security features enabled`);
    logger.log(`📦 Compression enabled`);
    logger.log(`🌐 I18n language detection enabled`);
    logger.log(`🛡️  JWT authentication enabled`);
    logger.log(`🌍 CORS origins: ${allowedOrigins.join(', ')}`);
    logger.log(`📊 Request logging enabled`);

    if (EnvConfig.isProduction()) {
      logger.log(`⚡ Rate limiting enabled`);
    }

    if (EnvConfig.isDevelopment()) {
      logger.log(`🧪 Test endpoints available at /test/*`);
      logger.log(`📋 Health check available at /health`);
      logger.log(`🕐 Scheduled tasks enabled (session cleanup)`);
    }

    // Log configuration summary
    const configSummary = EnvConfig.getConfigSummary();
    logger.log('📊 Application configuration:');
    logger.log(`   - Environment: ${configSummary.environment}`);
    logger.log(
      `   - Database: ${configSummary.database.host}:${configSummary.database.port}`,
    );
    logger.log(
      `   - Security: ${configSummary.security.jwtConfigured ? '✅' : '❌'} JWT configured`,
    );
    logger.log(
      `   - Features: Health=${configSummary.features.healthCheck}, Redis=${configSummary.features.redis}, SMTP=${configSummary.features.smtp}`,
    );
  } catch (error) {
    logger.error('❌ Application failed to start:', error);

    // Enhanced error messages based on common issues
    if (error.message?.includes('EADDRINUSE')) {
      const port = process.env.PORT || 3001;
      logger.error(
        `Port ${port} is already in use. Please choose a different port or stop the conflicting process.`,
      );
      logger.error(`Try: lsof -ti:${port} | xargs kill -9`);
    } else if (error.message?.includes('validation')) {
      logger.error(
        'Environment variable validation failed. Please check your .env file.',
      );
      logger.error(
        'Required variables: NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET',
      );
    } else if (error.message?.includes('EnvConfig not initialized')) {
      logger.error(
        "EnvConfig initialization failed. This should be fixed now, but if you see this, there's a deeper issue.",
      );
    } else if (error.message?.includes('connect ECONNREFUSED')) {
      logger.error(
        'Database connection failed. Please check your DATABASE_URL and ensure PostgreSQL is running.',
      );
    } else if (error.message?.includes('JWT_SECRET')) {
      logger.error(
        'JWT configuration error. Please ensure JWT_SECRET and JWT_REFRESH_SECRET are properly set.',
      );
    }

    // Show the actual error for debugging
    logger.error('Detailed error:', error.stack);

    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  const logger = new Logger('Shutdown');
  logger.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  const logger = new Logger('Shutdown');
  logger.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = new Logger('UncaughtException');
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('UnhandledRejection');
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

bootstrap();
