// src/app.module.ts - Updated with standalone I18n module
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AppI18nModule } from './i18n/i18n.module'; // Standalone I18n module
import { TestModule } from './test/test.module'; // Development only
import { UsersModule } from './users/users.module'; // Users module for user management

const developmentModules =
  process.env.NODE_ENV === 'development' ? [TestModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    HealthModule,
    AppI18nModule, // Now using standalone implementation
    UsersModule,
    ...developmentModules, // Only include TestModule in development
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
