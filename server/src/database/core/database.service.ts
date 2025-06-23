// src/database/core/database.service.ts - REFACTORED CORE SERVICE
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

export interface DatabaseConfig {
  connectionLimit: number;
  poolTimeout: number;
  connectionTimeout: number;
  statementTimeout: number;
  idleTimeout: number;
}

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly logger = new Logger(DatabaseService.name);
  private readonly config: DatabaseConfig;

  constructor(private configService: ConfigService) {
    const config = DatabaseService.buildDatabaseConfig(configService);

    super({
      datasources: {
        db: {
          url: DatabaseService.buildConnectionString(
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
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
      this.logConnectionInfo();
    } catch (error) {
      this.logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('✅ Database disconnected gracefully');
    } catch (error) {
      this.logger.error('❌ Error during database disconnection:', error);
    }
  }

  /**
   * Build database configuration from environment
   */
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

  /**
   * Build optimized PostgreSQL connection string
   */
  private static buildConnectionString(
    baseUrl: string,
    config: DatabaseConfig,
  ): string {
    try {
      const url = new URL(baseUrl);

      // Add connection optimization parameters
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

  /**
   * Basic health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get connection configuration
   */
  getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  /**
   * Log connection information
   */
  private logConnectionInfo(): void {
    this.logger.log(`📊 Connection pool configured:`);
    this.logger.log(`   - Max connections: ${this.config.connectionLimit}`);
    this.logger.log(`   - Pool timeout: ${this.config.poolTimeout}s`);
    this.logger.log(
      `   - Connection timeout: ${this.config.connectionTimeout}s`,
    );
  }

  /**
   * Execute query with basic error handling
   */
  async safeQuery<T>(queryFn: () => Promise<T>, operation: string): Promise<T> {
    try {
      return await queryFn();
    } catch (error) {
      this.logger.error(`Query failed for operation: ${operation}`, error);
      throw error;
    }
  }

  /**
   * Execute transaction with error handling
   */
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
}
