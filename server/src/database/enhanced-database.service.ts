// src/database/enhanced-database.service.ts - FULLY MERGED VERSION
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

// ==========================================
// INTERFACES & TYPES
// ==========================================

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface DatabaseConfig {
  connectionLimit: number;
  poolTimeout: number;
  connectionTimeout: number;
  statementTimeout: number;
  idleTimeout: number;
}

export interface DatabaseMetrics {
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  usedConnections: number;
  connectionPoolUsage: number;
  connectionPoolHealth: 'healthy' | 'warning' | 'critical';
}

export interface HealthCheckResult {
  healthy: boolean;
  metrics: DatabaseMetrics;
  details: {
    canConnect: boolean;
    canQuery: boolean;
    responseTime: number;
    connectionPool: string;
    queryPerformance: string;
  };
  timestamp: string;
}

export interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  totalQueryTime: number;
  averageQueryTime: number;
  queriesPerSecond: number;
  slowQueryThreshold: number;
}

export interface DatabaseEvent {
  type: 'query' | 'error' | 'warn' | 'info';
  timestamp: number;
  duration?: number;
  query?: string;
  params?: string;
  message?: string;
  target?: string;
}

// Database query result types for typed queries
interface MaxConnectionsQueryResult {
  max_connections: number;
}

interface ConnectionStatsQueryResult {
  total: number;
  active: number;
  idle: number;
  idle_in_transaction: number;
}

@Injectable()
export class EnhancedDatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EnhancedDatabaseService.name);
  private readonly config: DatabaseConfig;
  private queryMetrics: QueryMetrics;
  private startTime: number;
  private monitoringInterval?: NodeJS.Timeout;
  private queryCache = new Map<string, { data: any; expiry: number }>();

  constructor(private configService: ConfigService) {
    const config = EnhancedDatabaseService.buildDatabaseConfig(configService);

    super({
      datasources: {
        db: {
          url: EnhancedDatabaseService.buildConnectionString(
            configService.get('DATABASE_URL')!,
            config,
          ),
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    this.config = config;
    this.startTime = Date.now();
    this.queryMetrics = {
      totalQueries: 0,
      slowQueries: 0,
      totalQueryTime: 0,
      averageQueryTime: 0,
      queriesPerSecond: 0,
      slowQueryThreshold: 1000,
    };

    this.setupEventListeners();
  }

  // ==========================================
  // MODULE LIFECYCLE
  // ==========================================

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Enhanced Database connected successfully');
      this.logConnectionInfo();
      this.startPerformanceMonitoring();
      this.startHealthMonitoring();
    } catch (error) {
      this.logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      this.stopMonitoring();
      await this.$disconnect();
      this.logger.log('📝 Database disconnected gracefully');
    } catch (error) {
      this.logger.error('❌ Database disconnection error:', error);
    }
  }

  // ==========================================
  // CONFIGURATION & CONNECTION
  // ==========================================

  private static buildDatabaseConfig(
    configService: ConfigService,
  ): DatabaseConfig {
    return {
      connectionLimit: parseInt(configService.get('DB_CONNECTION_LIMIT', '10')),
      poolTimeout: parseInt(configService.get('DB_POOL_TIMEOUT', '10')),
      connectionTimeout: parseInt(
        configService.get('DB_CONNECTION_TIMEOUT', '5'),
      ),
      statementTimeout: parseInt(
        configService.get('DB_STATEMENT_TIMEOUT', '30000'),
      ),
      idleTimeout: parseInt(configService.get('DB_IDLE_TIMEOUT', '60000')),
    };
  }

  private static buildConnectionString(
    baseUrl: string,
    config: DatabaseConfig,
  ): string {
    try {
      const url = new URL(baseUrl);

      const params = {
        connection_limit: config.connectionLimit.toString(),
        pool_timeout: config.poolTimeout.toString(),
        connect_timeout: config.connectionTimeout.toString(),
        statement_timeout: config.statementTimeout.toString(),
        idle_in_transaction_session_timeout: config.idleTimeout.toString(),
        tcp_keepalives_idle: '600',
        tcp_keepalives_interval: '30',
        tcp_keepalives_count: '3',
        application_name: 'nest-api',
        sslmode: 'prefer',
      };

      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      return url.toString();
    } catch (error) {
      console.warn('Failed to parse DATABASE_URL, using as-is:', error.message);
      return baseUrl;
    }
  }

  private logConnectionInfo(): void {
    this.logger.log(`📊 Connection pool configured:`);
    this.logger.log(`   - Max connections: ${this.config.connectionLimit}`);
    this.logger.log(`   - Pool timeout: ${this.config.poolTimeout}s`);
    this.logger.log(
      `   - Connection timeout: ${this.config.connectionTimeout}s`,
    );
  }

  getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  // ==========================================
  // HEALTH MONITORING (MERGED FROM DatabaseHealthService)
  // ==========================================

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  async healthCheck() {
    try {
      const start = Date.now();
      await this.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;

      return {
        healthy: true,
        status: 'healthy',
        database: 'connected',
        responseTime: duration,
        timestamp: new Date().toISOString(),
        details: {
          connection: 'active',
          responseTime: `${duration}ms`,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
        details: {
          connection: 'failed',
          error: error.message,
        },
      };
    }
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    let canConnect = false;
    let canQuery = false;
    let metrics: DatabaseMetrics;

    try {
      canConnect = await this.isHealthy();

      if (canConnect) {
        await this.$queryRaw`SELECT 1 as health_check`;
        canQuery = true;
        metrics = await this.getDatabaseMetrics();
      } else {
        metrics = this.getDefaultMetrics();
      }
    } catch (error) {
      this.logger.error('Health check failed:', error);
      metrics = this.getDefaultMetrics();
    }

    const responseTime = Date.now() - start;
    const healthy =
      canConnect &&
      canQuery &&
      responseTime < 2000 &&
      metrics.connectionPoolHealth !== 'critical';

    return {
      healthy,
      metrics,
      details: {
        canConnect,
        canQuery,
        responseTime,
        connectionPool: metrics.connectionPoolHealth,
        queryPerformance: this.getQueryPerformanceStatus(responseTime),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const [connectionStats, activeConnections] = await Promise.all([
        this.getMaxConnections(),
        this.getActiveConnections(),
      ]);

      const maxConnections = connectionStats || this.config.connectionLimit;
      const connectionPoolUsage =
        maxConnections > 0
          ? (activeConnections.total / maxConnections) * 100
          : 0;

      const connectionPoolHealth = this.assessConnectionPoolHealth(
        connectionPoolUsage,
        activeConnections.idleInTransaction,
      );

      return {
        activeConnections: activeConnections.active,
        idleConnections: activeConnections.idle,
        maxConnections,
        usedConnections: activeConnections.total,
        connectionPoolUsage: Math.round(connectionPoolUsage * 100) / 100,
        connectionPoolHealth,
      };
    } catch (error) {
      this.logger.error('Failed to get database metrics:', error);
      return this.getDefaultMetrics();
    }
  }

  private async getMaxConnections(): Promise<number> {
    try {
      const result = await this.$queryRaw`
        SELECT setting::int as max_connections
        FROM pg_settings 
        WHERE name = 'max_connections'
      `;

      if (Array.isArray(result) && result.length > 0) {
        const firstResult = result[0] as MaxConnectionsQueryResult;
        return firstResult?.max_connections || 100;
      }

      return 100;
    } catch (error) {
      this.logger.warn(
        'Could not get max_connections from PostgreSQL:',
        error.message,
      );
      return this.config.connectionLimit;
    }
  }

  private async getActiveConnections(): Promise<{
    total: number;
    active: number;
    idle: number;
    idleInTransaction: number;
  }> {
    try {
      const result = await this.$queryRaw`
        SELECT 
          count(*)::int as total,
          count(*) FILTER (WHERE state = 'active')::int as active,
          count(*) FILTER (WHERE state = 'idle')::int as idle,
          count(*) FILTER (WHERE state = 'idle in transaction')::int as idle_in_transaction
        FROM pg_stat_activity 
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
      `;

      if (Array.isArray(result) && result.length > 0) {
        const stats = result[0] as ConnectionStatsQueryResult;
        return {
          total: stats?.total || 0,
          active: stats?.active || 0,
          idle: stats?.idle || 0,
          idleInTransaction: stats?.idle_in_transaction || 0,
        };
      }

      return { total: 0, active: 0, idle: 0, idleInTransaction: 0 };
    } catch (error) {
      this.logger.warn(
        'Could not get connection stats from PostgreSQL:',
        error.message,
      );
      return { total: 0, active: 0, idle: 0, idleInTransaction: 0 };
    }
  }

  private assessConnectionPoolHealth(
    usagePercentage: number,
    idleInTransaction: number,
  ): 'healthy' | 'warning' | 'critical' {
    if (usagePercentage > 90 || idleInTransaction > 5) {
      return 'critical';
    }
    if (usagePercentage > 70 || idleInTransaction > 2) {
      return 'warning';
    }
    return 'healthy';
  }

  private getQueryPerformanceStatus(responseTime: number): string {
    if (responseTime < 100) return 'excellent';
    if (responseTime < 300) return 'good';
    if (responseTime < 1000) return 'fair';
    return 'poor';
  }

  private getDefaultMetrics(): DatabaseMetrics {
    return {
      activeConnections: 0,
      idleConnections: 0,
      maxConnections: this.config.connectionLimit,
      usedConnections: 0,
      connectionPoolUsage: 0,
      connectionPoolHealth: 'critical',
    };
  }

  startHealthMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.getDatabaseMetrics();
        this.checkConnectionPoolHealth(metrics);
      } catch (error) {
        this.logger.error('Failed to monitor database health:', error);
      }
    }, intervalMs);

    this.logger.log('✅ Database health monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      this.logger.log('🛑 Database health monitoring stopped');
    }
  }

  private checkConnectionPoolHealth(metrics: DatabaseMetrics): void {
    if (metrics.connectionPoolHealth === 'critical') {
      this.logger.error('🚨 Connection Pool Critical State', {
        activeConnections: metrics.activeConnections,
        maxConnections: metrics.maxConnections,
        usage: metrics.connectionPoolUsage,
        health: metrics.connectionPoolHealth,
      });
    } else if (metrics.connectionPoolHealth === 'warning') {
      this.logger.warn('⚠️ Connection Pool Warning', {
        activeConnections: metrics.activeConnections,
        maxConnections: metrics.maxConnections,
        usage: metrics.connectionPoolUsage,
        health: metrics.connectionPoolHealth,
      });
    }
  }

  // ==========================================
  // PERFORMANCE MONITORING (MERGED FROM DatabaseMonitoringService)
  // ==========================================

  private setupEventListeners(): void {
    if (process.env.NODE_ENV === 'development') {
      this.$on('query' as never, (e: Prisma.QueryEvent) => {
        this.handleQueryEvent({
          type: 'query',
          timestamp: Date.now(),
          duration: e.duration,
          query: e.query,
          params: e.params,
        });
      });
    }

    this.$on('error' as never, (e: Prisma.LogEvent) => {
      this.handleErrorEvent({
        type: 'error',
        timestamp: Date.now(),
        message: e.message,
        target: e.target,
      });
    });
  }

  private handleQueryEvent(event: DatabaseEvent): void {
    if (!event.duration) return;

    this.queryMetrics.totalQueries++;
    this.queryMetrics.totalQueryTime += event.duration;
    this.queryMetrics.averageQueryTime =
      this.queryMetrics.totalQueryTime / this.queryMetrics.totalQueries;

    if (event.duration > this.queryMetrics.slowQueryThreshold) {
      this.queryMetrics.slowQueries++;
      this.logSlowQuery(event);
    }

    if (process.env.NODE_ENV === 'development' && event.duration > 100) {
      this.logger.debug(`📊 Query: ${event.duration}ms`, {
        query: this.sanitizeQuery(event.query || '').substring(0, 200),
        duration: event.duration,
      });
    }
  }

  private handleErrorEvent(event: DatabaseEvent): void {
    this.logger.error('💥 Database Error', {
      message: event.message,
      target: event.target,
      timestamp: new Date(event.timestamp).toISOString(),
    });
  }

  private logSlowQuery(event: DatabaseEvent): void {
    const slowQueryRatio =
      this.queryMetrics.slowQueries / this.queryMetrics.totalQueries;

    this.logger.warn(`🐌 Slow Query Detected`, {
      duration: event.duration,
      query: this.sanitizeQuery(event.query || ''),
      params: event.params,
      timestamp: new Date(event.timestamp).toISOString(),
      slowQueryRatio: (slowQueryRatio * 100).toFixed(2) + '%',
    });

    if (slowQueryRatio > 0.1 && this.queryMetrics.totalQueries > 100) {
      this.logger.error('🚨 High slow query ratio detected', {
        slowQueries: this.queryMetrics.slowQueries,
        totalQueries: this.queryMetrics.totalQueries,
        ratio: (slowQueryRatio * 100).toFixed(2) + '%',
      });
    }
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updateQueriesPerSecond();
      this.logPerformanceSummary();
    }, 60000);
  }

  private updateQueriesPerSecond(): void {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    this.queryMetrics.queriesPerSecond =
      elapsedSeconds > 0 ? this.queryMetrics.totalQueries / elapsedSeconds : 0;
  }

  private logPerformanceSummary(): void {
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;

    if (Math.floor(elapsedMinutes) % 5 === 0 && elapsedMinutes > 0) {
      this.logger.log('📈 Database Performance Summary', {
        totalQueries: this.queryMetrics.totalQueries,
        queriesPerSecond: this.queryMetrics.queriesPerSecond.toFixed(2),
        averageQueryTime: this.queryMetrics.averageQueryTime.toFixed(2) + 'ms',
        slowQueries: this.queryMetrics.slowQueries,
        slowQueryRatio:
          (
            (this.queryMetrics.slowQueries / this.queryMetrics.totalQueries) *
            100
          ).toFixed(2) + '%',
      });
    }
  }

  private sanitizeQuery(query: string): string {
    return query
      .replace(/('[^']*'|"[^"]*")/g, '[REDACTED]')
      .replace(/\$\d+/g, '[PARAM]')
      .substring(0, 500);
  }

  getQueryMetrics(): QueryMetrics {
    this.updateQueriesPerSecond();
    return { ...this.queryMetrics };
  }

  resetMetrics(): void {
    this.queryMetrics = {
      totalQueries: 0,
      slowQueries: 0,
      totalQueryTime: 0,
      averageQueryTime: 0,
      queriesPerSecond: 0,
      slowQueryThreshold: 1000,
    };
    this.startTime = Date.now();
  }

  setSlowQueryThreshold(milliseconds: number): void {
    this.queryMetrics.slowQueryThreshold = milliseconds;
    this.logger.log(`🎯 Slow query threshold updated to ${milliseconds}ms`);
  }

  // ==========================================
  // ENHANCED OPERATIONS (ORIGINAL FEATURES)
  // ==========================================

  async monitoredQuery<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - start;

      if (duration > 1000) {
        this.logger.warn(`Slow query: ${operationName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(`Query error in ${operationName}:`, error);
      throw error;
    }
  }

  async monitoredTransaction<T>(
    transactionFn: (tx: any) => Promise<T>,
    operationName: string,
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await this.$transaction(transactionFn);
      const duration = Date.now() - start;

      if (duration > 2000) {
        this.logger.warn(
          `Slow transaction: ${operationName} took ${duration}ms`,
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(`Transaction error in ${operationName}:`, error);
      throw error;
    }
  }

  async paginate<T>(
    model: any,
    page: number = 1,
    limit: number = 10,
    where?: any,
    orderBy?: any,
  ): Promise<PaginatedResult<T>> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      model.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      model.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

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
  ): Promise<{
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
    metadata: {
      requestedCount: number;
      returnedCount: number;
      hasNextPage: boolean;
    };
  }> {
    const {
      cursor,
      take = 10,
      where = {},
      orderBy = { id: 'desc' },
      include,
      select,
    } = options;

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
  }

  async bulkUpsert<T>(
    model: string,
    data: any[],
    uniqueFields: string[],
  ): Promise<T[]> {
    if (data.length === 0) return [];

    return await this.monitoredTransaction(async (tx) => {
      const results: T[] = [];

      for (const item of data) {
        const whereClause = uniqueFields.reduce((acc, field) => {
          acc[field] = item[field];
          return acc;
        }, {});

        const result = await tx[model].upsert({
          where: whereClause,
          update: item,
          create: item,
        });

        results.push(result);
      }

      return results;
    }, `bulk-upsert-${model}`);
  }

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

  clearQueryCache(): void {
    this.queryCache.clear();
    this.logger.log('🗑️ Query cache cleared');
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  async safeQuery<T>(queryFn: () => Promise<T>, operation: string): Promise<T> {
    try {
      return await queryFn();
    } catch (error) {
      this.logger.error(`Query failed for operation: ${operation}`, error);
      throw error;
    }
  }

  async safeTransaction<T>(
    transactionFn: (tx: any) => Promise<T>,
    operation: string,
  ): Promise<T> {
    try {
      return await this.$transaction(transactionFn);
    } catch (error) {
      this.logger.error(
        `Transaction failed for operation: ${operation}`,
        error,
      );
      throw error;
    }
  }

  async getDatabaseMetricsComplete() {
    const healthCheck = await this.healthCheck();
    const queryMetrics = this.getQueryMetrics();
    const connectionMetrics = await this.getDatabaseMetrics();

    return {
      healthy: healthCheck.healthy,
      responseTime: healthCheck.responseTime,
      connectionPoolHealth: connectionMetrics.connectionPoolHealth,
      totalQueries: queryMetrics.totalQueries,
      slowQueries: queryMetrics.slowQueries,
      avgQueryTime: queryMetrics.averageQueryTime,
      queriesPerSecond: queryMetrics.queriesPerSecond,
      connectionStats: {
        active: connectionMetrics.activeConnections,
        idle: connectionMetrics.idleConnections,
        total: connectionMetrics.usedConnections,
        max: connectionMetrics.maxConnections,
        usage: connectionMetrics.connectionPoolUsage,
      },
    };
  }

  getPerformanceAnalysis(): {
    status: 'excellent' | 'good' | 'warning' | 'critical';
    metrics: QueryMetrics;
    recommendations: string[];
  } {
    const metrics = this.getQueryMetrics();
    const slowQueryRatio =
      metrics.totalQueries > 0
        ? (metrics.slowQueries / metrics.totalQueries) * 100
        : 0;

    let status: 'excellent' | 'good' | 'warning' | 'critical';
    const recommendations: string[] = [];

    if (metrics.averageQueryTime < 100 && slowQueryRatio < 5) {
      status = 'excellent';
    } else if (metrics.averageQueryTime < 200 && slowQueryRatio < 10) {
      status = 'good';
    } else if (metrics.averageQueryTime < 500 && slowQueryRatio < 20) {
      status = 'warning';
      recommendations.push('Consider optimizing frequently used queries');
    } else {
      status = 'critical';
      recommendations.push(
        'Immediate attention required for query optimization',
      );
      recommendations.push('Review database indices and query patterns');
    }

    if (metrics.averageQueryTime > 300) {
      recommendations.push('Average query time is high - review slow queries');
    }

    if (slowQueryRatio > 15) {
      recommendations.push(
        'High slow query ratio - consider adding database indices',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Database performance is optimal');
    }

    return {
      status,
      metrics,
      recommendations,
    };
  }
}
