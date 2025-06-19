// src/app.module.ts - UPDATED with Environment Validation and EnvConfig
import { Module, Type, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AppI18nModule } from './i18n/i18n.module';
import { UsersModule } from './users/users.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import {
  envValidationSchema,
  EnvironmentVariables,
} from './config/env.validation';
import { EnvConfig } from './config/env.utils';

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
export class AppModule implements OnModuleInit {
  constructor(private configService: ConfigService<EnvironmentVariables>) {}

  onModuleInit() {
    // IMPROVED: Check if EnvConfig is already initialized (from main.ts)
    // If not, initialize it here
    try {
      EnvConfig.NODE_ENV; // Test if it's already initialized
    } catch (error) {
      // Not initialized yet, so initialize it
      EnvConfig.initialize(this.configService);
    }

    // IMPROVED: Use EnvConfig for type-safe access
    const env = EnvConfig.NODE_ENV;
    const port = EnvConfig.PORT;

    console.log(`🏗️  Application starting in ${env} mode on port ${port}`);

    // IMPROVED: Enhanced configuration logging with type safety
    if (EnvConfig.isDevelopment()) {
      const configSummary = EnvConfig.getConfigSummary();

      console.log('📋 Configuration loaded:');
      console.log(
        `   - Database: ${configSummary.database.host}:${configSummary.database.port}/${configSummary.database.database}`,
      );
      console.log(
        `   - JWT: ${configSummary.security.jwtConfigured ? '✅ Configured' : '❌ Missing'}`,
      );
      console.log(`   - CORS Origins: ${EnvConfig.ALLOWED_ORIGINS.join(', ')}`);
      console.log(
        `   - Rate Limiting: ${EnvConfig.RATE_LIMIT_MAX} req/${EnvConfig.RATE_LIMIT_TTL}ms`,
      );
      console.log(
        `   - Health Check: ${configSummary.features.healthCheck ? '✅ Enabled' : '❌ Disabled'}`,
      );

      if (configSummary.features.redis) {
        console.log(
          `   - Redis: ${EnvConfig.REDIS_HOST}:${EnvConfig.REDIS_PORT}`,
        );
      }

      if (configSummary.features.smtp) {
        console.log(`   - SMTP: ${EnvConfig.SMTP_HOST}:${EnvConfig.SMTP_PORT}`);
      }
    }
  }
}
