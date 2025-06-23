// src/database/index.ts - SIMPLIFIED EXPORTS AFTER MERGE
export { EnhancedDatabaseService } from './enhanced-database.service';
export { DatabaseModule } from './database.module';

// ✅ REMOVED: DatabaseService, DatabaseMonitoringService, DatabaseHealthService
// All functionality now available through EnhancedDatabaseService

// Types - still exported for type safety
export type {
  DatabaseMetrics,
  HealthCheckResult,
  QueryMetrics,
  PaginatedResult,
  DatabaseConfig,
} from './enhanced-database.service';
