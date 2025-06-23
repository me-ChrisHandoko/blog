// src/app.module.ts
import { Module, Type, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AppI18nModule } from './i18n/i18n.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

// Import services using barrel exports
import { EnhancedDatabaseService } from './database';
import { LanguageService } from './i18n';

import {
  envValidationSchema,
  EnvironmentVariables,
} from './config/env.validation';

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
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      expandVariables: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: parseInt(process.env.RATE_LIMIT_TTL || '60000'),
          limit: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        },
      ],
    }),
    DatabaseModule,
    AppI18nModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ...getConditionalModules(),
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [],
})
export class AppModule implements OnModuleInit {
  constructor(
    private configService: ConfigService<EnvironmentVariables>,
    private enhancedDatabase: EnhancedDatabaseService,
    private languageService: LanguageService,
  ) {}

  async onModuleInit() {
    const env = process.env.NODE_ENV || 'development';
    console.log(`🏗️  AppModule initialized in ${env} mode`);
    console.log(`📦 All modules loaded successfully`);

    await this.validateServicesHealth();

    if (env === 'development') {
      console.log('📋 Development features enabled');
    }
  }

  private async validateServicesHealth(): Promise<void> {
    try {
      const dbHealth = await this.enhancedDatabase.isHealthy();
      const testTranslation = this.languageService.translate(
        'common.messages.success',
        'en' as any,
      );

      if (dbHealth) console.log('✅ Database service healthy');
      if (testTranslation) console.log('✅ Language service healthy');
    } catch (error) {
      console.error('❌ Service health validation failed:', error.message);
    }
  }
}
