// src/app.module.ts - Updated with standalone I18n module
import { Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AppI18nModule } from './i18n/i18n.module'; // Standalone I18n module
import { UsersModule } from './users/users.module'; // Users module for user management
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';

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
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    DatabaseModule,
    HealthModule,
    AppI18nModule, // Now using standalone implementation
    AuthModule,
    UsersModule,
    ...getConditionalModules(), // Only include TestModule in development
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    if (process.env.NODE_ENV === 'development') {
      console.log('🏗️  Application started in development mode');
    } else {
      console.log('🚀 Application started in production mode');
    }
  }
}
