// src/bootstrap/security-setup.ts
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { EnvConfig } from '../config/env.utils';
import { Logger } from '@nestjs/common';

export class SecuritySetup {
  private static readonly logger = new Logger('SecuritySetup');

  static async configure(app: NestFastifyApplication): Promise<void> {
    try {
      await this.configureHelmet(app);
      await this.configureCors(app);
      await this.configureCompression(app);

      if (EnvConfig.isProduction()) {
        await this.configureRateLimiting(app);
      }

      this.logger.log('✅ Security configuration completed');
    } catch (error) {
      this.logger.error('❌ Security configuration failed:', error);
      throw error;
    }
  }

  private static async configureHelmet(
    app: NestFastifyApplication,
  ): Promise<void> {
    await app.register(require('@fastify/helmet'), {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          scriptSrc: [`'self'`],
          imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
          connectSrc: [`'self'`],
          fontSrc: [`'self'`],
          objectSrc: [`'none'`],
          mediaSrc: [`'self'`],
          frameSrc: [`'none'`],
        },
      },
      crossOriginEmbedderPolicy: false,
    });

    this.logger.debug('🛡️ Helmet security headers configured');
  }

  private static async configureCors(
    app: NestFastifyApplication,
  ): Promise<void> {
    const allowedOrigins = EnvConfig.ALLOWED_ORIGINS;

    await app.register(require('@fastify/cors'), {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        if (EnvConfig.isDevelopment() && origin.includes('localhost')) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Language',
        'X-Request-ID',
      ],
    });

    this.logger.debug(
      `🌍 CORS configured for origins: ${allowedOrigins.join(', ')}`,
    );
  }

  private static async configureCompression(
    app: NestFastifyApplication,
  ): Promise<void> {
    await app.register(require('@fastify/compress'), {
      global: true,
      threshold: 1024,
      encodings: ['gzip', 'deflate'],
    });

    this.logger.debug('📦 Response compression configured');
  }

  private static async configureRateLimiting(
    app: NestFastifyApplication,
  ): Promise<void> {
    await app.register(require('@fastify/rate-limit'), {
      max: EnvConfig.RATE_LIMIT_MAX,
      timeWindow: EnvConfig.RATE_LIMIT_TTL,
      keyGenerator: (request) => {
        return (
          request.user?.id ||
          request.headers['x-forwarded-for'] ||
          request.headers['x-real-ip'] ||
          request.ip ||
          'unknown'
        );
      },
      errorResponseBuilder: (request, context) => ({
        error: 'Too Many Requests',
        statusCode: 429,
        retryAfter: Math.round(context.ttl / 1000),
        message: 'Rate limit exceeded. Please try again later.',
      }),
      skipOnError: true,
      skipSuccessfulRequests: false,
    });

    this.logger.debug(
      `⚡ Rate limiting: ${EnvConfig.RATE_LIMIT_MAX} requests per ${EnvConfig.RATE_LIMIT_TTL}ms`,
    );
  }
}
