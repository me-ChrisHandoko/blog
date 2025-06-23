// src/database/health/database-health.service.ts - FIXED WITH EXPLICIT TYPE HANDLING
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../core/database.service';

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

// ✅ ADDED: Proper type definitions for database query results
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
export class DatabaseHealthService {
  private readonly logger = new Logger(DatabaseHealthService.name);
  private monitoringInterval?: NodeJS.Timeout;

  constructor(private databaseService: DatabaseService) {}

  /**
   * Start connection pool monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
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

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      this.logger.log('🛑 Database health monitoring stopped');
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    let canConnect = false;
    let canQuery = false;
    let metrics: DatabaseMetrics;

    try {
      // Test basic connection
      canConnect = await this.databaseService.isHealthy();

      if (canConnect) {
        // Test query execution
        await this.databaseService.$queryRaw`SELECT 1 as health_check`;
        canQuery = true;

        // Get detailed metrics
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

  /**
   * Get database connection metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const [connectionStats, activeConnections] = await Promise.all([
        this.getMaxConnections(),
        this.getActiveConnections(),
      ]);

      const maxConnections =
        connectionStats || this.databaseService.getConfig().connectionLimit;
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

  /**
   * Get maximum connections from PostgreSQL
   */
  private async getMaxConnections(): Promise<number> {
    try {
      // ✅ FIXED: Use explicit type handling with proper casting
      const result = await this.databaseService.$queryRaw`
        SELECT setting::int as max_connections
        FROM pg_settings 
        WHERE name = 'max_connections'
      `;

      // ✅ FIXED: Explicit type checking and casting
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
      return this.databaseService.getConfig().connectionLimit;
    }
  }

  /**
   * Get active connection statistics
   */
  private async getActiveConnections(): Promise<{
    total: number;
    active: number;
    idle: number;
    idleInTransaction: number;
  }> {
    try {
      // ✅ FIXED: Use explicit type handling with proper casting
      const result = await this.databaseService.$queryRaw`
        SELECT 
          count(*)::int as total,
          count(*) FILTER (WHERE state = 'active')::int as active,
          count(*) FILTER (WHERE state = 'idle')::int as idle,
          count(*) FILTER (WHERE state = 'idle in transaction')::int as idle_in_transaction
        FROM pg_stat_activity 
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
      `;

      // ✅ FIXED: Explicit type checking and casting
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

  /**
   * Assess connection pool health
   */
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

  /**
   * Get query performance status based on response time
   */
  private getQueryPerformanceStatus(responseTime: number): string {
    if (responseTime < 100) return 'excellent';
    if (responseTime < 300) return 'good';
    if (responseTime < 1000) return 'fair';
    return 'poor';
  }

  /**
   * Check connection pool health and log warnings
   */
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

  /**
   * Get default metrics when database is unavailable
   */
  private getDefaultMetrics(): DatabaseMetrics {
    return {
      activeConnections: 0,
      idleConnections: 0,
      maxConnections: this.databaseService.getConfig().connectionLimit,
      usedConnections: 0,
      connectionPoolUsage: 0,
      connectionPoolHealth: 'critical',
    };
  }

  /**
   * Get health summary for monitoring dashboards
   */
  async getHealthSummary(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: string;
    connections: {
      used: number;
      max: number;
      usage: string;
    };
    performance: {
      averageResponseTime: number;
      status: string;
    };
    issues: string[];
  }> {
    const healthCheck = await this.performHealthCheck();

    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (!healthCheck.healthy) {
      status = 'unhealthy';
      issues.push('Database connection failed');
    } else if (healthCheck.metrics.connectionPoolHealth === 'critical') {
      status = 'unhealthy';
      issues.push('Connection pool at critical capacity');
    } else if (
      healthCheck.metrics.connectionPoolHealth === 'warning' ||
      healthCheck.details.responseTime > 1000
    ) {
      status = 'degraded';
      if (healthCheck.metrics.connectionPoolHealth === 'warning') {
        issues.push('Connection pool usage high');
      }
      if (healthCheck.details.responseTime > 1000) {
        issues.push('Slow database response times');
      }
    } else {
      status = 'healthy';
    }

    return {
      status,
      uptime: process.uptime().toFixed(0) + 's',
      connections: {
        used: healthCheck.metrics.usedConnections,
        max: healthCheck.metrics.maxConnections,
        usage: healthCheck.metrics.connectionPoolUsage.toFixed(1) + '%',
      },
      performance: {
        averageResponseTime: healthCheck.details.responseTime,
        status: healthCheck.details.queryPerformance,
      },
      issues: issues.length > 0 ? issues : ['No issues detected'],
    };
  }

  /**
   * Cleanup resources
   */
  onModuleDestroy(): void {
    this.stopMonitoring();
  }
}
