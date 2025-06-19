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
import { EnvironmentVariables } from './config/env.validation';
import { EnvConfig } from './config/env.utils'; // ADDED: Import EnvConfig utility

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

    // FIXED: Use EnvConfig for validation (already validated in AppModule)
    // No need for manual validation here since EnvConfig.validate() runs in AppModule

    // IMPROVED: Get environment variables using type-safe EnvConfig
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

      // app.useGlobalInterceptors(new ErrorResponseInterceptor(languageService));

      // IMPROVED: Rate limiting with env vars (only in production)
      if (EnvConfig.isProduction()) {
        await app.register(require('@fastify/rate-limit'), {
          max: rateLimitMax,
          timeWindow: rateLimitTtl,
          errorResponseBuilder: () => ({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded, please try again later.',
            statusCode: 429,
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
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        // IMPROVED: Better error messages
        disableErrorMessages: EnvConfig.isProduction(),
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
        `Port ${EnvConfig.PORT} is already in use. Please choose a different port.`,
      );
    } else if (error.message?.includes('validation')) {
      logger.error(
        'Environment variable validation failed. Please check your .env file.',
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
