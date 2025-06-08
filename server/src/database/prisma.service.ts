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
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'pretty', // Better error formatting for development
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      // Explicit type annotation resolves the TypeScript warning
      await (this.$connect() as Promise<void>);
      this.logger.log('✅ Database connected successfully');

      // Optional: Test the connection with a simple query
      await this.$queryRaw`SELECT 1`;
      this.logger.log('✅ Database connection verified');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database:', error);
      // In production, you might want to throw the error to prevent app startup
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await (this.$disconnect() as Promise<void>);
      this.logger.log('✅ Database disconnected gracefully');
    } catch (error) {
      this.logger.error('❌ Error during database disconnection:', error);
    }
  }

  // Helper method for health checks and connection testing
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
