import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
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
export class EnhancedDatabaseService extends PrismaClient {
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

    // Setup query logging
    if (process.env.NODE_ENV === 'development') {
      this.$on('query', (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    this.$on('error', (e: any) => {
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
}
