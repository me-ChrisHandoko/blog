// src/database/database.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseService } from './core/database.service';
import { DatabaseMonitoringService } from './monitoring/database-monitoring.service';
import { DatabaseHealthService } from './health/database-health.service';
import { EnhancedDatabaseService } from './enhanced-database.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    DatabaseService,
    DatabaseMonitoringService,
    DatabaseHealthService,
    EnhancedDatabaseService,
    {
      provide: 'PrismaService',
      useExisting: EnhancedDatabaseService,
    },
  ],
  exports: [
    DatabaseService,
    DatabaseMonitoringService,
    DatabaseHealthService,
    EnhancedDatabaseService,
    'PrismaService',
  ],
})
export class DatabaseModule {}
