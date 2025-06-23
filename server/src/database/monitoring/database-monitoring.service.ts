// src/database/monitoring/database-monitoring.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../core/database.service';

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

@Injectable()
export class DatabaseMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMonitoringService.name);
  private queryMetrics: QueryMetrics;
  private startTime: number;

  constructor(private databaseService: DatabaseService) {
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

  onModuleInit(): void {
    this.setupEventListeners();
    this.startPerformanceMonitoring();
    this.logger.log('✅ Database monitoring initialized');
  }

  /**
   * Setup database event listeners
   */
  private setupEventListeners(): void {
    // Query events
    (this.databaseService as any).$on('query', (e: any) => {
      this.handleQueryEvent({
        type: 'query',
        timestamp: e.timestamp || Date.now(),
        duration: e.duration,
        query: e.query,
        params: e.params,
      });
    });

    // Error events
    (this.databaseService as any).$on('error', (e: any) => {
      this.handleErrorEvent({
        type: 'error',
        timestamp: e.timestamp || Date.now(),
        message: e.message,
        target: e.target,
      });
    });

    // Warning events
    (this.databaseService as any).$on('warn', (e: any) => {
      this.handleWarningEvent({
        type: 'warn',
        timestamp: e.timestamp || Date.now(),
        message: e.message,
        target: e.target,
      });
    });

    // Info events
    (this.databaseService as any).$on('info', (e: any) => {
      this.handleInfoEvent({
        type: 'info',
        timestamp: e.timestamp || Date.now(),
        message: e.message,
        target: e.target,
      });
    });
  }

  /**
   * Handle query events and update metrics
   */
  private handleQueryEvent(event: DatabaseEvent): void {
    if (!event.duration) return;

    this.queryMetrics.totalQueries++;
    this.queryMetrics.totalQueryTime += event.duration;
    this.queryMetrics.averageQueryTime =
      this.queryMetrics.totalQueryTime / this.queryMetrics.totalQueries;

    // Check for slow queries
    if (event.duration > this.queryMetrics.slowQueryThreshold) {
      this.queryMetrics.slowQueries++;
      this.logSlowQuery(event);
    }

    // Development query logging
    if (process.env.NODE_ENV === 'development' && event.duration > 100) {
      this.logger.debug(`📊 Query: ${event.duration}ms`, {
        query: this.sanitizeQuery(event.query || '').substring(0, 200),
        duration: event.duration,
      });
    }
  }

  /**
   * Handle database errors
   */
  private handleErrorEvent(event: DatabaseEvent): void {
    this.logger.error('💥 Database Error', {
      message: event.message,
      target: event.target,
      timestamp: new Date(event.timestamp).toISOString(),
    });
  }

  /**
   * Handle database warnings
   */
  private handleWarningEvent(event: DatabaseEvent): void {
    this.logger.warn('⚠️ Database Warning', {
      message: event.message,
      target: event.target,
      timestamp: new Date(event.timestamp).toISOString(),
    });
  }

  /**
   * Handle database info events
   */
  private handleInfoEvent(event: DatabaseEvent): void {
    this.logger.log('ℹ️ Database Info', {
      message: event.message,
      target: event.target,
      timestamp: new Date(event.timestamp).toISOString(),
    });
  }

  /**
   * Log slow query with context
   */
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

    // Alert for high slow query ratio
    if (slowQueryRatio > 0.1 && this.queryMetrics.totalQueries > 100) {
      this.logger.error('🚨 High slow query ratio detected', {
        slowQueries: this.queryMetrics.slowQueries,
        totalQueries: this.queryMetrics.totalQueries,
        ratio: (slowQueryRatio * 100).toFixed(2) + '%',
      });
    }
  }

  /**
   * Start performance monitoring interval
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updateQueriesPerSecond();
      this.logPerformanceSummary();
    }, 60000); // Every minute
  }

  /**
   * Update queries per second metric
   */
  private updateQueriesPerSecond(): void {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    this.queryMetrics.queriesPerSecond =
      elapsedSeconds > 0 ? this.queryMetrics.totalQueries / elapsedSeconds : 0;
  }

  /**
   * Log performance summary every 5 minutes
   */
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

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/('[^']*'|"[^"]*")/g, '[REDACTED]')
      .replace(/\$\d+/g, '[PARAM]')
      .substring(0, 500);
  }

  /**
   * Get current query metrics
   */
  getQueryMetrics(): QueryMetrics {
    this.updateQueriesPerSecond();
    return { ...this.queryMetrics };
  }

  /**
   * Reset metrics (useful for testing)
   */
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

  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(milliseconds: number): void {
    this.queryMetrics.slowQueryThreshold = milliseconds;
    this.logger.log(`🎯 Slow query threshold updated to ${milliseconds}ms`);
  }

  /**
   * Get performance analysis
   */
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
