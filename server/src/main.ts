// src/main.ts - FIXED with proper environment validation
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

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    // Create NestJS app with Fastify adapter
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: process.env.NODE_ENV !== 'production',
        trustProxy: true,
      }),
    );

    // FIXED: Initialize EnvConfig manually since onModuleInit hasn't run yet
    const configService =
      app.get<ConfigService<EnvironmentVariables>>(ConfigService);
    EnvConfig.initialize(configService);

    // Get environment variables using type-safe EnvConfig
    const nodeEnv = EnvConfig.NODE_ENV;
    const port = EnvConfig.PORT;
    const allowedOrigins = EnvConfig.ALLOWED_ORIGINS;
    const rateLimitTtl = EnvConfig.RATE_LIMIT_TTL;
    const rateLimitMax = EnvConfig.RATE_LIMIT_MAX;

    // Get services
    const reflector = app.get(Reflector);
    const languageService = app.get(LanguageService);

    logger.log(`🚀 Starting application in ${nodeEnv} mode`);

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

      // IMPROVED: CORS configuration with env vars
      await app.register(require('@fastify/cors'), {
        origin: allowedOrigins,
        credentials: true,
      });

      // Compression
      await app.register(require('@fastify/compress'));

      app.useGlobalInterceptors(new ErrorResponseInterceptor(languageService));

      // IMPROVED: Rate limiting with env vars (only in production)

      if (EnvConfig.isProduction()) {
        await app.register(require('@fastify/rate-limit'), {
          max: rateLimitMax,
          timeWindow: rateLimitTtl,
          keyGenerator: (request) => {
            return request.user?.id || request.ip;
          },
          errorResponseBuilder: (request, context) => ({
            error: 'Too Many Requests',
            message: this.languageService.translate(
              'auth.messages.rateLimitExceeded',
              request.detectedLanguage || 'id',
            ),
            statusCode: 429,
            retryAfter: Math.round(context.ttl / 1000),
          }),
        });
        logger.log(
          `⚡ Rate limiting enabled: ${rateLimitMax} req/${rateLimitTtl}ms`,
        );
      }

      logger.log('✅ Fastify plugins registered successfully');
    } catch (error) {
      logger.error('❌ Error registering Fastify plugins:', error);
      throw error;
    }

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: EnvConfig.isDevelopment(), // Only in dev
        transform: true,
        transformOptions: {
          enableImplicitConversion: false, // Disable expensive conversion
        },
        skipMissingProperties: false,
        skipNullProperties: false,
        skipUndefinedProperties: false,
      }),
    );

    // Global guards - Order matters!
    app.useGlobalGuards(
      new LanguageGuard(languageService), // First: Detect language
      new JwtAuthGuard(reflector), // Then: Authenticate
    );

    // FIXED: Single error handling approach
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

    if (EnvConfig.isProduction()) {
      logger.log(`⚡ Rate limiting enabled`);
    }

    if (EnvConfig.isDevelopment()) {
      logger.log(`🧪 Test endpoints available at /test/*`);
      logger.log(`📋 Health check available at /health`);
    }
  } catch (error) {
    logger.error('❌ Application failed to start:', error);

    // IMPROVED: More helpful error messages
    if (error.message?.includes('EADDRINUSE')) {
      logger.error(
        `Port ${process.env.PORT || 3001} is already in use. Please choose a different port.`,
      );
    } else if (error.message?.includes('validation')) {
      logger.error(
        'Environment variable validation failed. Please check your .env file.',
      );
    } else if (error.message?.includes('EnvConfig not initialized')) {
      logger.error(
        'EnvConfig initialization failed. This is likely a module loading issue.',
      );
    }

    process.exit(1);
  }
}

// IMPROVED: Graceful shutdown handling
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

bootstrap();
