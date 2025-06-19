// src/app.module.ts - UPDATED with Environment Validation
import { Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AppI18nModule } from './i18n/i18n.module';
import { UsersModule } from './users/users.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './config/env.validation'; // ADDED: Import validation schema

function getConditionalModules(): Type<any>[] {
  const modules: Type<any>[] = [];

  if (process.env.NODE_ENV === 'development') {
    try {
      const { TestModule } = require('./test/test.module');
      modules.push(TestModule);
      console.log('🧪 TestModule loaded for development');
    } catch (error) {
      console.warn('⚠️  Could not load TestModule:', error.message);
    }
  }

  return modules;
}

@Module({
  imports: [
    // IMPROVED: ConfigModule with validation schema
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'], // Support multiple env files
      validationSchema: envValidationSchema, // ADDED: Validate environment variables
      validationOptions: {
        allowUnknown: true, // Allow extra env vars not in schema
        abortEarly: false, // Show all validation errors, not just first one
      },
      expandVariables: true, // Support variable expansion like ${VAR}
    }),

    // IMPROVED: ThrottlerModule with env vars
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: parseInt(process.env.RATE_LIMIT_TTL || '60000'),
          limit: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        },
      ],
    }),

    DatabaseModule,
    HealthModule,
    AppI18nModule,
    AuthModule,
    UsersModule,
    ...getConditionalModules(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    const env = process.env.NODE_ENV || 'development';
    const port = process.env.PORT || 3001;

    console.log(`🏗️  Application starting in ${env} mode on port ${port}`);

    // Log important configuration (without secrets)
    if (env === 'development') {
      console.log('📋 Configuration loaded:');
      console.log(
        `   - Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ Missing'}`,
      );
      console.log(
        `   - JWT: ${process.env.JWT_SECRET ? '✅ Configured' : '❌ Missing'}`,
      );
      console.log(
        `   - CORS Origins: ${process.env.ALLOWED_ORIGINS || 'http://localhost:3000'}`,
      );
      console.log(
        `   - Rate Limiting: ${process.env.RATE_LIMIT_MAX || 100} req/${process.env.RATE_LIMIT_TTL || 60000}ms`,
      );
    }
  }
}
