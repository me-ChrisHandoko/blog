import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { LanguageGuard } from './i18n/guards/language.guard';
import { I18nExceptionFilter } from './common/filters/i18n-exception.filter';
import { LanguageService } from './i18n/services/language.service';
import { ErrorResponseInterceptor } from './common/interceptors/error-response.interceptor'; // OPTION 1: Use Interceptor
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // Create NestJS app with Fastify adapter
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      trustProxy: true, // For production behind proxy
    }),
  );

  const configService = app.get(ConfigService);
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
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
      ],
      credentials: true,
    });

    // Compression
    await app.register(require('@fastify/compress'));

    // OPTION 1: Use Error Response Interceptor (Recommended for Fastify)
    app.useGlobalInterceptors(new ErrorResponseInterceptor(languageService));

    // OPTION 2: Use Exception Filter (Alternative - comment out option 1 if using this)
    // app.useGlobalFilters(new HttpExceptionFilter(languageService));

    console.log('✅ Fastify plugins registered successfully');
  } catch (error) {
    console.error('❌ Error registering Fastify plugins:', error);
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
    }),
  );

  // Global guards - IMPORTANT: Order matters!
  app.useGlobalGuards(
    new JwtAuthGuard(reflector), // Then authenticate
  );

  // Global exception filter untuk translate error messages
  app.useGlobalFilters(new I18nExceptionFilter(languageService));

  // Start server
  const port = configService.get('PORT') || 3001;
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

  await app.listen(port, host);
  console.log(`🚀 Application running on: http://${host}:${port}`);
  console.log(`🔐 Security features enabled`);
  console.log(`📦 Compression enabled`);
  console.log(`🌐 I18n validation enabled`);
}

bootstrap().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});
