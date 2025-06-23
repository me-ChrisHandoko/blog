// src/health/health.module.ts - FIXED IMPORTS
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { EnhancedHealthService } from './enhanced-health.service'; // ✅ FIXED: Now points to existing file

import { DatabaseModule } from '../database/database.module';
import { AppI18nModule } from '../i18n/i18n.module';

@Module({
  imports: [DatabaseModule, AppI18nModule],
  providers: [EnhancedHealthService],
  controllers: [HealthController],
  exports: [EnhancedHealthService],
})
export class HealthModule {}
