// src/health/index.ts - FIXED EXPORTS
export { EnhancedHealthService } from './enhanced-health.service'; // ✅ FIXED: Now points to existing file
export { HealthController } from './health.controller';
export { HealthModule } from './health.module';
export type {
  SystemHealthCheck,
  ServiceHealth,
} from './enhanced-health.service';
