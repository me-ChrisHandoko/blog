// src/bootstrap/startup-logger.ts
import { Logger } from '@nestjs/common';
import { EnvConfig } from '../config/env.utils';

export class StartupLogger {
  private static readonly logger = new Logger('Startup');

  static logStartup(host: string, port: number): void {
    const nodeEnv = EnvConfig.NODE_ENV;

    this.logger.log(`🚀 Application running on: http://${host}:${port}`);
    this.logger.log(`📊 Environment: ${nodeEnv}`);

    this.logFeatures();
    this.logConfiguration();

    if (EnvConfig.isDevelopment()) {
      this.logDevelopmentInfo();
    }

    if (EnvConfig.isProduction()) {
      this.logProductionInfo();
    }
  }

  private static logFeatures(): void {
    this.logger.log('🔐 Security features enabled:');
    this.logger.log('   - JWT Authentication');
    this.logger.log('   - Security Headers (Helmet)');
    this.logger.log('   - CORS Protection');
    this.logger.log('   - Request Validation');
    this.logger.log('   - Input Sanitization');

    this.logger.log('📦 Core features enabled:');
    this.logger.log('   - Response Compression');
    this.logger.log('   - Multi-language Support (I18n)');
    this.logger.log('   - Request Logging');
    this.logger.log('   - Error Handling');
    this.logger.log('   - Database Monitoring');

    if (EnvConfig.isProduction()) {
      this.logger.log('   - Rate Limiting');
    }
  }

  private static logConfiguration(): void {
    const configSummary = EnvConfig.getConfigSummary();

    this.logger.log('📊 Configuration Summary:');
    this.logger.log(
      `   - Database: ${configSummary.database.host}:${configSummary.database.port}`,
    );
    this.logger.log(
      `   - JWT: ${configSummary.security.jwtConfigured ? 'Configured' : 'Missing'}`,
    );
    this.logger.log(`   - CORS Origins: ${configSummary.security.corsOrigins}`);
    this.logger.log(
      `   - Rate Limiting: ${configSummary.security.rateLimitEnabled ? 'Enabled' : 'Disabled'}`,
    );
    this.logger.log(
      `   - Health Checks: ${configSummary.features.healthCheck ? 'Enabled' : 'Disabled'}`,
    );
    this.logger.log(
      `   - Redis: ${configSummary.features.redis ? 'Connected' : 'Not configured'}`,
    );
    this.logger.log(
      `   - SMTP: ${configSummary.features.smtp ? 'Configured' : 'Not configured'}`,
    );
  }

  private static logDevelopmentInfo(): void {
    this.logger.log('🧪 Development features:');
    this.logger.log('   - Detailed request logging');
    this.logger.log('   - Enhanced error messages');
    this.logger.log('   - Translation validation');
    this.logger.log('   - Database query monitoring');
    this.logger.log('   - Test endpoints available');

    this.logger.log('🔗 Available endpoints:');
    this.logger.log('   - Health: /health');
    this.logger.log('   - Test: /test/*');
    this.logger.log('   - API: /api/*');
  }

  private static logProductionInfo(): void {
    this.logger.log('🚀 Production optimizations:');
    this.logger.log('   - Rate limiting active');
    this.logger.log('   - Minimal logging');
    this.logger.log('   - Error details hidden');
    this.logger.log('   - Performance monitoring');
  }

  static logStartupError(error: Error): void {
    this.logger.error('❌ Application failed to start:', error.message);

    if (error.message?.includes('EADDRINUSE')) {
      const port = process.env.PORT || 3001;
      this.logger.error(`Port ${port} is already in use.`);
      this.logger.error('💡 Solutions:');
      this.logger.error(`   - Kill process: lsof -ti:${port} | xargs kill -9`);
      this.logger.error(`   - Use different port: PORT=3002 npm start`);
    } else if (error.message?.includes('validation')) {
      this.logger.error('Environment variable validation failed.');
      this.logger.error('💡 Required variables:');
      this.logger.error('   - NODE_ENV, PORT, DATABASE_URL');
      this.logger.error('   - JWT_SECRET, JWT_REFRESH_SECRET');
      this.logger.error('   - Check your .env file');
    } else if (error.message?.includes('connect ECONNREFUSED')) {
      this.logger.error('Database connection failed.');
      this.logger.error('💡 Solutions:');
      this.logger.error('   - Check DATABASE_URL is correct');
      this.logger.error('   - Ensure PostgreSQL is running');
      this.logger.error('   - Verify database credentials');
    } else if (error.message?.includes('JWT')) {
      this.logger.error('JWT configuration error.');
      this.logger.error('💡 Solutions:');
      this.logger.error('   - Set JWT_SECRET (min 32 characters)');
      this.logger.error('   - Set JWT_REFRESH_SECRET (min 32 characters)');
    }

    if (EnvConfig.isDevelopment()) {
      this.logger.error('📋 Full error details:', error.stack);
    }
  }

  static logShutdown(signal: string): void {
    this.logger.log(`🛑 ${signal} received, shutting down gracefully...`);
  }
}
