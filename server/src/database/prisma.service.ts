// src/database/prisma.service.ts - FIXED VERSION
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // ✅ FIXED: Change from private to protected to allow inheritance
  protected readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['warn', 'error'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('✅ Database disconnected successfully');
    } catch (error) {
      this.logger.error('❌ Error during database disconnection:', error);
    }
  }

  /**
   * ✅ Health check method untuk compatibility
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
   * ✅ Basic query stats (for compatibility)
   */
  getQueryStats() {
    return {
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      slowQueryRatio: '0%',
      queriesPerSecond: 0,
    };
  }
}
