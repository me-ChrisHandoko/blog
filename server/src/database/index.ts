// src/database/index.ts
export { DatabaseService } from './core/database.service';
export { DatabaseMonitoringService } from './monitoring/database-monitoring.service';
export { DatabaseHealthService } from './health/database-health.service';
export { EnhancedDatabaseService } from './enhanced-database.service';
export { DatabaseModule } from './database.module';

// Types
export type {
  DatabaseMetrics,
  HealthCheckResult,
} from './health/database-health.service';
export type { QueryMetrics } from './monitoring/database-monitoring.service';
export type { PaginatedResult } from './enhanced-database.service';
