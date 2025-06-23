// src/app.module.ts - KEY UPDATES
import { Module, Type, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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

// ✅ Import enhanced database services
import { EnhancedPrismaService } from './database/enhanced-prisma.service';
import { QueryOptimizerService } from './database/query-optimizer.service';
import { PrismaService } from './database/prisma.service';

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
    // ConfigModule with validation schema
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

    // ScheduleModule for task scheduling (@Cron decorators)
    ScheduleModule.forRoot(),

    // ThrottlerModule with env vars
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
  providers: [
    AppService,
    // ✅ UPDATED: Provide enhanced database services globally
    {
      provide: PrismaService,
      useClass: EnhancedPrismaService,
    },
    EnhancedPrismaService,
    QueryOptimizerService,
  ],
  // ✅ Export enhanced services for other modules
  exports: [EnhancedPrismaService, QueryOptimizerService],
})
export class AppModule implements OnModuleInit {
  constructor(
    private configService: ConfigService<EnvironmentVariables>,
    private enhancedPrisma: EnhancedPrismaService, // ✅ Use enhanced service
  ) {}

  onModuleInit() {
    const env = process.env.NODE_ENV || 'development';
    const port = process.env.PORT || 3001;

    console.log(`🏗️  AppModule initialized in ${env} mode`);
    console.log(`📦 All modules loaded successfully`);
    console.log(`🚀 Enhanced database services activated`);

    // Only log basic info here since detailed logging happens in main.ts
    if (env === 'development') {
      console.log('📋 Development features enabled:');
      console.log('   - Enhanced error messages');
      console.log('   - Test endpoints');
      console.log('   - Detailed logging');
      console.log('   - Scheduled task monitoring');
      console.log('   - Query performance monitoring');
      console.log('   - Database connection pooling');
    }
  }
}
