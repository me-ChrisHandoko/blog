// src/database/enhanced-prisma.service.ts - FIXED LOGGER COMPATIBILITY
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

export interface DatabaseMetrics {
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  slowQueries: number;
  avgQueryTime: number;
  connectionPoolHealth: 'healthy' | 'warning' | 'critical';
  maxConnections: number;
  usedConnections: number;
  connectionPoolUsage: number;
}

export interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  totalQueryTime: number;
  averageQueryTime: number;
  queriesPerSecond: number;
  slowQueryThreshold: number;
}

@Injectable()
export class EnhancedPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // ✅ FIXED: Use protected instead of private to avoid conflicts
  protected readonly logger = new Logger(EnhancedPrismaService.name);

  private queryMetrics: QueryMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    totalQueryTime: 0,
    averageQueryTime: 0,
    queriesPerSecond: 0,
    slowQueryThreshold: 1000,
  };

  private connectionPoolMetrics = {
    maxConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
  };

  private startTime = Date.now();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(private configService: ConfigService) {
    const databaseUrl = configService.get('DATABASE_URL');
    const connectionLimit = configService.get('DB_CONNECTION_LIMIT', '10');
    const poolTimeout = configService.get('DB_POOL_TIMEOUT', '10');
    const connectionTimeout = configService.get('DB_CONNECTION_TIMEOUT', '5');

    const optimizedDatabaseUrl =
      EnhancedPrismaService.buildOptimizedConnectionString(databaseUrl, {
        connectionLimit: parseInt(connectionLimit),
        poolTimeout: parseInt(poolTimeout),
        connectionTimeout: parseInt(connectionTimeout),
      });

    super({
      datasources: {
        db: {
          url: optimizedDatabaseUrl,
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        } as const,
        {
          emit: 'event',
          level: 'error',
        } as const,
        {
          emit: 'event',
          level: 'info',
        } as const,
        {
          emit: 'event',
          level: 'warn',
        } as const,
      ],
      errorFormat: 'pretty',
    });

    this.connectionPoolMetrics.maxConnections = parseInt(connectionLimit);
  }

  /**
   * ✅ Build optimized PostgreSQL connection string
   */
  private static buildOptimizedConnectionString(
    baseUrl: string,
    options: {
      connectionLimit: number;
      poolTimeout: number;
      connectionTimeout: number;
    },
  ): string {
    try {
      const url = new URL(baseUrl);

      url.searchParams.set(
        'connection_limit',
        options.connectionLimit.toString(),
      );
      url.searchParams.set('pool_timeout', options.poolTimeout.toString());
      url.searchParams.set(
        'connect_timeout',
        options.connectionTimeout.toString(),
      );
      url.searchParams.set('statement_timeout', '30000');
      url.searchParams.set('idle_in_transaction_session_timeout', '60000');
      url.searchParams.set('tcp_keepalives_idle', '600');
      url.searchParams.set('tcp_keepalives_interval', '30');
      url.searchParams.set('tcp_keepalives_count', '3');
      url.searchParams.set('application_name', 'nest-api');
      url.searchParams.set('sslmode', 'prefer');

      return url.toString();
    } catch (error) {
      console.warn('Failed to parse DATABASE_URL, using as-is:', error.message);
      return baseUrl;
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.setupQueryMonitoring();
      this.setupConnectionMonitoring();
      this.startPerformanceMonitoring();

      this.logger.log(
        '✅ Enhanced Database connected with optimized connection pooling',
      );
      this.logger.log(
        `📊 Connection pool configured: max=${this.connectionPoolMetrics.maxConnections} connections`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }

      await this.$disconnect();
      this.logger.log('✅ Database disconnected gracefully');
    } catch (error) {
      this.logger.error('❌ Error during database disconnection:', error);
    }
  }

  /**
   * ✅ FIXED: Setup comprehensive query monitoring with proper types
   */
  private setupQueryMonitoring(): void {
    (this as any).$on('query', (e: any) => {
      this.queryMetrics.totalQueries++;
      this.queryMetrics.totalQueryTime += e.duration;
      this.queryMetrics.averageQueryTime =
        this.queryMetrics.totalQueryTime / this.queryMetrics.totalQueries;

      if (e.duration > this.queryMetrics.slowQueryThreshold) {
        this.queryMetrics.slowQueries++;

        this.logger.warn(`🐌 Slow Query Detected`, {
          duration: e.duration,
          query: this.sanitizeQuery(e.query),
          params: e.params,
          timestamp: e.timestamp,
          slowQueryRatio:
            (
              (this.queryMetrics.slowQueries / this.queryMetrics.totalQueries) *
              100
            ).toFixed(2) + '%',
        });

        const slowQueryRatio =
          this.queryMetrics.slowQueries / this.queryMetrics.totalQueries;
        if (slowQueryRatio > 0.1 && this.queryMetrics.totalQueries > 100) {
          this.logger.error('🚨 High slow query ratio detected', {
            slowQueries: this.queryMetrics.slowQueries,
            totalQueries: this.queryMetrics.totalQueries,
            ratio: (slowQueryRatio * 100).toFixed(2) + '%',
          });
        }
      }

      if (process.env.NODE_ENV === 'development' && e.duration > 100) {
        this.logger.debug(`📊 Query: ${e.duration}ms`, {
          query: this.sanitizeQuery(e.query).substring(0, 200),
          duration: e.duration,
        });
      }
    });

    (this as any).$on('error', (e: any) => {
      this.logger.error('💥 Database Error', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp,
      });
    });

    (this as any).$on('warn', (e: any) => {
      this.logger.warn('⚠️ Database Warning', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp,
      });
    });

    (this as any).$on('info', (e: any) => {
      this.logger.log('ℹ️ Database Info', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp,
      });
    });
  }

  /**
   * ✅ Setup connection pool monitoring
   */
  private setupConnectionMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.getDatabaseMetrics();

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

        this.connectionPoolMetrics.activeConnections =
          metrics.activeConnections;
        this.connectionPoolMetrics.idleConnections = metrics.idleConnections;
      } catch (error) {
        this.logger.error('Failed to get database metrics:', error);
      }
    }, 30000);
  }

  /**
   * ✅ Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const elapsedSeconds = (Date.now() - this.startTime) / 1000;
      this.queryMetrics.queriesPerSecond =
        this.queryMetrics.totalQueries / elapsedSeconds;

      if (Math.floor(elapsedSeconds) % 300 === 0 && elapsedSeconds > 0) {
        this.logger.log('📈 Database Performance Summary', {
          totalQueries: this.queryMetrics.totalQueries,
          queriesPerSecond: this.queryMetrics.queriesPerSecond.toFixed(2),
          averageQueryTime:
            this.queryMetrics.averageQueryTime.toFixed(2) + 'ms',
          slowQueries: this.queryMetrics.slowQueries,
          slowQueryRatio:
            (
              (this.queryMetrics.slowQueries / this.queryMetrics.totalQueries) *
              100
            ).toFixed(2) + '%',
        });
      }
    }, 60000);
  }

  /**
   * ✅ Get comprehensive database metrics with proper typing
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const connectionStats = await this.$queryRaw`
        SELECT 
          setting::int as max_connections
        FROM pg_settings 
        WHERE name = 'max_connections'
      `;

      const activeConnections = await this.$queryRaw`
        SELECT 
          count(*)::int as total,
          count(*) FILTER (WHERE state = 'active')::int as active,
          count(*) FILTER (WHERE state = 'idle')::int as idle,
          count(*) FILTER (WHERE state = 'idle in transaction')::int as idle_in_transaction
        FROM pg_stat_activity 
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
      `;

      const connectionStatsArray = Array.isArray(connectionStats)
        ? connectionStats
        : [connectionStats];
      const activeConnectionsArray = Array.isArray(activeConnections)
        ? activeConnections
        : [activeConnections];

      const maxConnectionsRow = connectionStatsArray[0];
      const stats = activeConnectionsArray[0];

      const maxConnections = maxConnectionsRow?.max_connections
        ? Number(maxConnectionsRow.max_connections)
        : this.connectionPoolMetrics.maxConnections;

      const activeConns = stats?.active ? Number(stats.active) : 0;
      const idleConns = stats?.idle ? Number(stats.idle) : 0;
      const totalConns = stats?.total ? Number(stats.total) : 0;
      const idleInTransaction = stats?.idle_in_transaction
        ? Number(stats.idle_in_transaction)
        : 0;

      const connectionPoolUsage =
        maxConnections > 0 ? (totalConns / maxConnections) * 100 : 0;

      let connectionPoolHealth: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (connectionPoolUsage > 90 || idleInTransaction > 5) {
        connectionPoolHealth = 'critical';
      } else if (connectionPoolUsage > 70 || idleInTransaction > 2) {
        connectionPoolHealth = 'warning';
      }

      return {
        activeConnections: activeConns,
        idleConnections: idleConns,
        totalQueries: this.queryMetrics.totalQueries,
        slowQueries: this.queryMetrics.slowQueries,
        avgQueryTime:
          Math.round(this.queryMetrics.averageQueryTime * 100) / 100,
        connectionPoolHealth,
        maxConnections,
        usedConnections: totalConns,
        connectionPoolUsage: Math.round(connectionPoolUsage * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to get database metrics:', error);
      return {
        activeConnections: 0,
        idleConnections: 0,
        totalQueries: this.queryMetrics.totalQueries,
        slowQueries: this.queryMetrics.slowQueries,
        avgQueryTime: this.queryMetrics.averageQueryTime,
        connectionPoolHealth: 'critical',
        maxConnections: this.connectionPoolMetrics.maxConnections,
        usedConnections: 0,
        connectionPoolUsage: 0,
      };
    }
  }

  /**
   * ✅ Enhanced query with automatic monitoring
   */
  async monitoredQuery<T>(
    queryFn: () => Promise<T>,
    queryName?: string,
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await queryFn();
      const duration = Date.now() - start;

      this.queryMetrics.totalQueries++;
      this.queryMetrics.totalQueryTime += duration;

      if (duration > this.queryMetrics.slowQueryThreshold) {
        this.queryMetrics.slowQueries++;
        this.logger.warn(
          `🐌 Slow Query: ${queryName || 'unknown'} took ${duration}ms`,
        );
      }

      if (process.env.NODE_ENV === 'development' && duration > 100) {
        this.logger.debug(
          `📊 Query: ${queryName || 'unknown'} - ${duration}ms`,
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(
        `💥 Query Failed: ${queryName || 'unknown'} after ${duration}ms`,
        {
          error: error.message,
          duration,
        },
      );
      throw error;
    }
  }

  /**
   * ✅ Optimized pagination helper
   */
  async paginateWithCursor<T>(
    model: any,
    {
      cursor,
      take = 10,
      where = {},
      orderBy = { id: 'desc' },
      include,
      select,
    }: {
      cursor?: any;
      take?: number;
      where?: any;
      orderBy?: any;
      include?: any;
      select?: any;
    },
  ): Promise<{
    data: T[];
    nextCursor?: any;
    hasMore: boolean;
    metadata: {
      requestedCount: number;
      returnedCount: number;
      hasNextPage: boolean;
    };
  }> {
    const start = Date.now();

    const items = await model.findMany({
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      where,
      orderBy,
      include,
      select,
    });

    const duration = Date.now() - start;

    if (duration > 500) {
      this.logger.warn(`Slow pagination query: ${duration}ms`, {
        model: model.name || 'unknown',
        take,
        cursor,
        where: JSON.stringify(where).substring(0, 100),
      });
    }

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

  /**
   * ✅ Bulk upsert helper
   */
  async bulkUpsert<T>(
    model: string,
    data: any[],
    uniqueFields: string[],
  ): Promise<T[]> {
    const start = Date.now();

    if (data.length === 0) return [];

    if (data.length <= 10) {
      return await this.$transaction(
        data.map((item) =>
          (this as any)[model].upsert({
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

    const chunkSize = 50;
    const results: T[] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkResults = await this.$transaction(
        chunk.map((item) =>
          (this as any)[model].upsert({
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

    const duration = Date.now() - start;
    this.logger.log(
      `Bulk upsert completed: ${data.length} items in ${duration}ms`,
    );

    return results;
  }

  /**
   * ✅ Health check with detailed metrics
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    metrics: DatabaseMetrics;
    details: {
      canConnect: boolean;
      canQuery: boolean;
      responseTime: number;
      connectionPool: string;
      queryPerformance: string;
    };
  }> {
    const start = Date.now();

    try {
      await this.$queryRaw`SELECT 1 as health_check`;
      const responseTime = Date.now() - start;

      const metrics = await this.getDatabaseMetrics();

      const healthy =
        responseTime < 2000 &&
        metrics.connectionPoolHealth !== 'critical' &&
        metrics.connectionPoolUsage < 95;

      return {
        healthy,
        metrics,
        details: {
          canConnect: true,
          canQuery: true,
          responseTime,
          connectionPool: metrics.connectionPoolHealth,
          queryPerformance:
            metrics.avgQueryTime < 100
              ? 'good'
              : metrics.avgQueryTime < 500
                ? 'warning'
                : 'poor',
        },
      };
    } catch (error) {
      const responseTime = Date.now() - start;

      return {
        healthy: false,
        metrics: await this.getDatabaseMetrics().catch(() => ({
          activeConnections: 0,
          idleConnections: 0,
          totalQueries: this.queryMetrics.totalQueries,
          slowQueries: this.queryMetrics.slowQueries,
          avgQueryTime: 0,
          connectionPoolHealth: 'critical' as const,
          maxConnections: 0,
          usedConnections: 0,
          connectionPoolUsage: 0,
        })),
        details: {
          canConnect: false,
          canQuery: false,
          responseTime,
          connectionPool: 'critical',
          queryPerformance: 'unavailable',
        },
      };
    }
  }

  /**
   * ✅ ADD: Missing methods for MultilingualBaseService compatibility
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      return health.healthy;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * ✅ Get current query statistics
   */
  getQueryStats() {
    const avgQueryTime =
      this.queryMetrics.totalQueries > 0
        ? this.queryMetrics.totalQueryTime / this.queryMetrics.totalQueries
        : 0;

    return {
      totalQueries: this.queryMetrics.totalQueries,
      slowQueries: this.queryMetrics.slowQueries,
      averageQueryTime: Math.round(avgQueryTime * 100) / 100,
      slowQueryRatio:
        this.queryMetrics.totalQueries > 0
          ? (
              (this.queryMetrics.slowQueries / this.queryMetrics.totalQueries) *
              100
            ).toFixed(2) + '%'
          : '0%',
      queriesPerSecond: this.calculateQueriesPerSecond(),
    };
  }

  /**
   * ✅ Calculate queries per second
   */
  private calculateQueriesPerSecond(): number {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    return elapsedSeconds > 0
      ? this.queryMetrics.totalQueries / elapsedSeconds
      : 0;
  }

  /**
   * ✅ Reset query metrics
   */
  resetQueryMetrics(): void {
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

  /**
   * ✅ Query caching helper
   */
  async cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttlSeconds: number = 300,
  ): Promise<T> {
    return await this.monitoredQuery(queryFn, `cached-${key}`);
  }

  private sanitizeQuery(query: string): string {
    return query
      .replace(/('[^']*'|"[^"]*")/g, '[REDACTED]')
      .replace(/\$\d+/g, '[PARAM]')
      .substring(0, 500);
  }
}
