// src/database/enhanced-database.service.ts - CLEAN FACADE PATTERN
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Import the specialized services
import { DatabaseService } from './core/database.service';
import {
  DatabaseMonitoringService,
  QueryMetrics,
} from './monitoring/database-monitoring.service';
import {
  DatabaseHealthService,
  DatabaseMetrics,
  HealthCheckResult,
} from './health/database-health.service';

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  metadata: {
    requestedCount: number;
    returnedCount: number;
    hasNextPage: boolean;
  };
}

@Injectable()
export class EnhancedDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EnhancedDatabaseService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly monitoringService: DatabaseMonitoringService,
    private readonly healthService: DatabaseHealthService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Start monitoring if enabled
    const enableMonitoring =
      this.configService.get('DB_MONITORING_ENABLED', 'true') === 'true';

    if (enableMonitoring) {
      this.healthService.startMonitoring(30000); // Every 30 seconds
    }

    this.logger.log('✅ Enhanced Database Service initialized');
    this.logServiceConfiguration();
  }

  async onModuleDestroy(): Promise<void> {
    this.healthService.stopMonitoring();
    this.logger.log('✅ Enhanced Database Service destroyed');
  }

  // ==========================================
  // CORE DATABASE OPERATIONS (Delegate to DatabaseService)
  // ==========================================

  /**
   * Execute monitored query with performance tracking
   */
  async monitoredQuery<T>(
    queryFn: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await this.databaseService.safeQuery(
        queryFn,
        operationName,
      );
      const duration = Date.now() - start;

      if (process.env.NODE_ENV === 'development' && duration > 100) {
        this.logger.debug(`⚡ ${operationName} - ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(
        `💥 Query Failed: ${operationName} after ${duration}ms`,
        {
          error: error.message,
          duration,
        },
      );
      throw error;
    }
  }

  /**
   * Execute monitored transaction
   */
  async monitoredTransaction<T>(
    transactionFn: (tx: any) => Promise<T>,
    operationName: string,
  ): Promise<T> {
    return await this.databaseService.safeTransaction(
      transactionFn,
      operationName,
    );
  }

  // ==========================================
  // OPTIMIZED QUERY HELPERS
  // ==========================================

  /**
   * Cursor-based pagination helper
   */
  async paginateWithCursor<T>(
    model: any,
    options: {
      cursor?: any;
      take?: number;
      where?: any;
      orderBy?: any;
      include?: any;
      select?: any;
    },
  ): Promise<PaginatedResult<T>> {
    const {
      cursor,
      take = 10,
      where = {},
      orderBy = { id: 'desc' },
      include,
      select,
    } = options;

    return await this.monitoredQuery(async () => {
      const items = await model.findMany({
        take: take + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where,
        orderBy,
        include,
        select,
      });

      const hasMore = items.length > take;
      const data = hasMore ? items.slice(0, -1) : items;
      const nextCursor =
        hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

      return {
        data,
        nextCursor,
        hasMore,
        metadata: {
          requestedCount: take,
          returnedCount: data.length,
          hasNextPage: hasMore,
        },
      };
    }, 'cursor-pagination');
  }

  /**
   * Bulk upsert operation
   */
  async bulkUpsert<T>(
    model: string,
    data: any[],
    uniqueFields: string[],
  ): Promise<T[]> {
    if (data.length === 0) return [];

    return await this.monitoredQuery(async () => {
      // For small datasets, use individual operations
      if (data.length <= 10) {
        return await this.databaseService.$transaction(
          data.map((item) =>
            (this.databaseService as any)[model].upsert({
              where: uniqueFields.reduce((acc, field) => {
                acc[field] = item[field];
                return acc;
              }, {}),
              update: item,
              create: item,
            }),
          ),
        );
      }

      // For larger datasets, process in chunks
      const chunkSize = 50;
      const results: T[] = [];

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const chunkResults = await this.databaseService.$transaction(
          chunk.map((item) =>
            (this.databaseService as any)[model].upsert({
              where: uniqueFields.reduce((acc, field) => {
                acc[field] = item[field];
                return acc;
              }, {}),
              update: item,
              create: item,
            }),
          ),
        );
        results.push(...chunkResults);
      }

      return results;
    }, `bulk-upsert-${model}`);
  }

  /**
   * Cached query execution (basic in-memory cache)
   */
  private queryCache = new Map<string, { data: any; expiry: number }>();

  async cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttlSeconds: number = 300,
  ): Promise<T> {
    const cached = this.queryCache.get(key);
    const now = Date.now();

    if (cached && cached.expiry > now) {
      return cached.data;
    }

    const result = await this.monitoredQuery(queryFn, `cached-${key}`);

    this.queryCache.set(key, {
      data: result,
      expiry: now + ttlSeconds * 1000,
    });

    return result;
  }

  // ==========================================
  // HEALTH & MONITORING (Delegate to specialized services)
  // ==========================================

  /**
   * Get comprehensive health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    return await this.healthService.performHealthCheck();
  }

  /**
   * Get database metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    return await this.healthService.getDatabaseMetrics();
  }

  /**
   * Get query performance metrics
   */
  getQueryStats(): QueryMetrics {
    return this.monitoringService.getQueryMetrics();
  }

  /**
   * Get performance analysis
   */
  getPerformanceAnalysis() {
    return this.monitoringService.getPerformanceAnalysis();
  }

  /**
   * Check if database is healthy
   */
  async isHealthy(): Promise<boolean> {
    return await this.databaseService.isHealthy();
  }

  /**
   * Get health summary for dashboards
   */
  async getHealthSummary() {
    return await this.healthService.getHealthSummary();
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Reset query metrics (for testing)
   */
  resetQueryMetrics(): void {
    this.monitoringService.resetMetrics();
  }

  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(milliseconds: number): void {
    this.monitoringService.setSlowQueryThreshold(milliseconds);
  }

  /**
   * Clear query cache
   */
  clearQueryCache(): void {
    this.queryCache.clear();
    this.logger.log('🗑️ Query cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    const activeEntries = Array.from(this.queryCache.entries()).filter(
      ([, value]) => value.expiry > now,
    ).length;

    return {
      totalEntries: this.queryCache.size,
      activeEntries,
      expiredEntries: this.queryCache.size - activeEntries,
    };
  }

  // ==========================================
  // PRISMA CLIENT DELEGATION
  // ==========================================

  // Delegate all Prisma operations to the core database service
  get user() {
    return this.databaseService.user;
  }
  get profile() {
    return this.databaseService.profile;
  }
  get profileTranslation() {
    return this.databaseService.profileTranslation;
  }
  get category() {
    return this.databaseService.category;
  }
  get categoryTranslation() {
    return this.databaseService.categoryTranslation;
  }
  get post() {
    return this.databaseService.post;
  }
  get postTranslation() {
    return this.databaseService.postTranslation;
  }
  get tag() {
    return this.databaseService.tag;
  }
  get tagTranslation() {
    return this.databaseService.tagTranslation;
  }
  get postTag() {
    return this.databaseService.postTag;
  }
  get comment() {
    return this.databaseService.comment;
  }
  get session() {
    return this.databaseService.session;
  }
  get permission() {
    return this.databaseService.permission;
  }
  get userPermission() {
    return this.databaseService.userPermission;
  }
  get auditLog() {
    return this.databaseService.auditLog;
  }

  // Prisma client methods
  get $connect() {
    return this.databaseService.$connect.bind(this.databaseService);
  }
  get $disconnect() {
    return this.databaseService.$disconnect.bind(this.databaseService);
  }
  get $executeRaw() {
    return this.databaseService.$executeRaw.bind(this.databaseService);
  }
  get $executeRawUnsafe() {
    return this.databaseService.$executeRawUnsafe.bind(this.databaseService);
  }
  get $queryRaw() {
    return this.databaseService.$queryRaw.bind(this.databaseService);
  }
  get $queryRawUnsafe() {
    return this.databaseService.$queryRawUnsafe.bind(this.databaseService);
  }
  get $transaction() {
    return this.databaseService.$transaction.bind(this.databaseService);
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Log service configuration on startup
   */
  private logServiceConfiguration(): void {
    const config = this.databaseService.getConfig();

    this.logger.log('📊 Enhanced Database Service Configuration:');
    this.logger.log(
      `   - Connection Pool: ${config.connectionLimit} max connections`,
    );
    this.logger.log(`   - Pool Timeout: ${config.poolTimeout}s`);
    this.logger.log(`   - Connection Timeout: ${config.connectionTimeout}s`);
    this.logger.log(`   - Monitoring: Enabled`);
    this.logger.log(`   - Health Checks: Enabled`);
    this.logger.log(`   - Query Caching: Enabled`);
  }

  /**
   * Get service statistics for debugging
   */
  getServiceStats() {
    const queryStats = this.getQueryStats();
    const cacheStats = this.getCacheStats();
    const performanceAnalysis = this.getPerformanceAnalysis();

    return {
      database: {
        queries: queryStats,
        cache: cacheStats,
        performance: performanceAnalysis,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
