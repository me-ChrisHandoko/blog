// src/health/enhanced-health.service.ts - NEW FILE
import { Injectable, Logger } from '@nestjs/common';
import { EnhancedDatabaseService } from '../database/enhanced-database.service';
import { LanguageService } from '../i18n/services/language.service';

export interface SystemHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: Record<string, ServiceHealth>;
  summary: {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    degradedServices: number;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  details?: any;
  lastCheck?: string;
  message?: string;
}

@Injectable()
export class EnhancedHealthService {
  private readonly logger = new Logger(EnhancedHealthService.name);

  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {}

  /**
   * Comprehensive system health check
   */
  async getSystemHealthCheck(): Promise<SystemHealthCheck> {
    const startTime = Date.now();

    // Check all services
    const [databaseHealth, i18nHealth, memoryHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkI18nHealth(),
      this.checkMemoryHealth(),
    ]);

    const services = {
      database: databaseHealth,
      i18n: i18nHealth,
      memory: memoryHealth,
    };

    // Calculate summary
    const serviceValues = Object.values(services);
    const healthyServices = serviceValues.filter(
      (s) => s.status === 'healthy',
    ).length;
    const unhealthyServices = serviceValues.filter(
      (s) => s.status === 'unhealthy',
    ).length;
    const degradedServices = serviceValues.filter(
      (s) => s.status === 'degraded',
    ).length;

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyServices > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const responseTime = Date.now() - startTime;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      summary: {
        totalServices: serviceValues.length,
        healthyServices,
        unhealthyServices,
        degradedServices,
      },
    };
  }

  /**
   * Quick health check for basic monitoring
   */
  async getQuickHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    responseTime: number;
  }> {
    const startTime = Date.now();

    try {
      // Quick database check
      const isDbHealthy = await this.database.isHealthy();
      const responseTime = Date.now() - startTime;

      return {
        status: isDbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get detailed service metrics
   */
  async getServiceMetrics(): Promise<{
    database: any;
    memory: any;
    cpu: any;
    uptime: number;
  }> {
    const [databaseMetrics, memoryMetrics] = await Promise.all([
      this.getDatabaseMetrics(),
      this.getMemoryMetrics(),
    ]);

    return {
      database: databaseMetrics,
      memory: memoryMetrics,
      cpu: this.getCpuMetrics(),
      uptime: process.uptime(),
    };
  }

  // ==========================================
  // PRIVATE HEALTH CHECK METHODS
  // ==========================================

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const healthCheck = await this.database.healthCheck();
      const responseTime = Date.now() - startTime;

      if (healthCheck.healthy) {
        return {
          status: responseTime > 1000 ? 'degraded' : 'healthy',
          responseTime,
          details: healthCheck.details,
          lastCheck: new Date().toISOString(),
          message:
            responseTime > 1000 ? 'Slow response time' : 'All checks passed',
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          details: healthCheck.details,
          lastCheck: new Date().toISOString(),
          message: 'Database connection failed',
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        message: `Database check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check i18n service health
   */
  private async checkI18nHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Test translation functionality
      const testTranslation = this.languageService.translate(
        'common.messages.success',
        'EN',
      );

      const supportedLanguages = this.languageService.getSupportedLanguages();
      const responseTime = Date.now() - startTime;

      const isHealthy = testTranslation && supportedLanguages.length > 0;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime,
        details: {
          supportedLanguages: supportedLanguages.length,
          testTranslation: testTranslation ? 'working' : 'failed',
        },
        lastCheck: new Date().toISOString(),
        message: isHealthy
          ? 'Translation service working'
          : 'Translation issues detected',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        message: `I18n check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check memory health
   */
  private checkMemoryHealth(): ServiceHealth {
    const startTime = Date.now();

    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory =
        memoryUsage.rss + memoryUsage.heapUsed + memoryUsage.external;
      const memoryInMB = totalMemory / 1024 / 1024;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;

      if (memoryInMB > 1000) {
        // > 1GB
        status = 'unhealthy';
        message = 'High memory usage detected';
      } else if (memoryInMB > 500) {
        // > 500MB
        status = 'degraded';
        message = 'Elevated memory usage';
      } else {
        status = 'healthy';
        message = 'Memory usage normal';
      }

      return {
        status,
        responseTime: Date.now() - startTime,
        details: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          totalMB: Math.round(memoryInMB),
        },
        lastCheck: new Date().toISOString(),
        message,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        message: `Memory check failed: ${error.message}`,
      };
    }
  }

  // ==========================================
  // METRICS COLLECTION METHODS
  // ==========================================

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics() {
    try {
      return await this.database.getDatabaseMetrics();
    } catch (error) {
      this.logger.error('Failed to get database metrics:', error);
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics() {
    const memoryUsage = process.memoryUsage();

    return {
      rss: memoryUsage.rss,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      usage: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      },
    };
  }

  /**
   * Get CPU metrics
   */
  private getCpuMetrics() {
    const cpuUsage = process.cpuUsage();

    return {
      user: cpuUsage.user,
      system: cpuUsage.system,
      usage: {
        user: `${Math.round(cpuUsage.user / 1000)}ms`,
        system: `${Math.round(cpuUsage.system / 1000)}ms`,
      },
    };
  }

  /**
   * Get application info
   */
  getApplicationInfo() {
    return {
      name: process.env.npm_package_name || 'nestjs-multilingual-app',
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
