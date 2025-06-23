// src/database/enhanced-database.service.ts - FIXED VERSION
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class EnhancedDatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EnhancedDatabaseService.name);

  constructor(private configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // ✅ FIXED: Setup query logging with proper event types
    if (process.env.NODE_ENV === 'development') {
      // Use proper Prisma event types
      this.$on('query' as never, (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // ✅ FIXED: Use proper error event type
    this.$on('error' as never, (e: Prisma.LogEvent) => {
      this.logger.error('Database error:', e);
    });
  }

  /**
   * Connect to database
   */
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Enhanced Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('📝 Database disconnected');
    } catch (error) {
      this.logger.error('❌ Database disconnection error:', error);
    }
  }

  /**
   * Check if database is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Basic health check
   */
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

  /**
   * Execute query with monitoring
   */
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

  /**
   * Execute transaction with monitoring
   */
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

  /**
   * Paginated query helper
   */
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

  /**
   * ✅ ADDED: Cursor-based pagination helper
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

  /**
   * ✅ ADDED: Bulk upsert operation
   */
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

  /**
   * ✅ ADDED: Cached query execution (basic in-memory cache)
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

  /**
   * ✅ ADDED: Clear query cache
   */
  clearQueryCache(): void {
    this.queryCache.clear();
    this.logger.log('🗑️ Query cache cleared');
  }

  /**
   * ✅ ADDED: Get database metrics (placeholder)
   */
  async getDatabaseMetrics() {
    const healthCheck = await this.healthCheck();

    return {
      healthy: healthCheck.healthy,
      responseTime: healthCheck.responseTime,
      connectionPoolHealth: healthCheck.healthy ? 'healthy' : 'unhealthy',
      // Add more metrics as needed
      totalQueries: 0,
      slowQueries: 0,
      avgQueryTime: 0,
    };
  }
}
