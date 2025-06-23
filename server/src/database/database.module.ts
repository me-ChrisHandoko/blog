// src/database/database.module.ts - SIMPLIFIED AFTER MERGE
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EnhancedDatabaseService } from './enhanced-database.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    EnhancedDatabaseService,
    {
      provide: 'PrismaService',
      useExisting: EnhancedDatabaseService,
    },
    // ✅ REMOVED: DatabaseService, DatabaseMonitoringService, DatabaseHealthService
    // All functionality now merged into EnhancedDatabaseService
  ],
  exports: [
    EnhancedDatabaseService,
    'PrismaService',
    // ✅ REMOVED: All other services - single point of access now
  ],
})
export class DatabaseModule {}
