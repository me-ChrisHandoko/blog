// src/config/env.utils.ts - Environment Configuration Utilities
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';

/**
 * Type-safe environment configuration utility
 * Provides strongly-typed access to environment variables
 */
export class EnvConfig {
  private static configService: ConfigService<EnvironmentVariables>;

  /**
   * Initialize the config service (called once in AppModule)
   */
  static initialize(configService: ConfigService<EnvironmentVariables>) {
    EnvConfig.configService = configService;
  }

  /**
   * Validate that the config service is initialized
   */
  private static ensureInitialized(): void {
    if (!EnvConfig.configService) {
      throw new Error(
        'EnvConfig not initialized. Call EnvConfig.initialize() in AppModule.',
      );
    }
  }

  // Application Settings
  static get NODE_ENV(): 'development' | 'production' | 'test' {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('NODE_ENV', { infer: true })!;
  }

  static get PORT(): number {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('PORT', { infer: true })!;
  }

  // Database Configuration
  static get DATABASE_URL(): string {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('DATABASE_URL', { infer: true })!;
  }

  // JWT Configuration
  static get JWT_SECRET(): string {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('JWT_SECRET', { infer: true })!;
  }

  static get JWT_EXPIRES_IN(): string {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('JWT_EXPIRES_IN', { infer: true })!;
  }

  static get JWT_REFRESH_SECRET(): string {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('JWT_REFRESH_SECRET', { infer: true })!;
  }

  static get JWT_REFRESH_EXPIRES_IN(): string {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('JWT_REFRESH_EXPIRES_IN', {
      infer: true,
    })!;
  }

  // CORS Configuration
  static get ALLOWED_ORIGINS(): string[] {
    EnvConfig.ensureInitialized();
    const origins = EnvConfig.configService.get('ALLOWED_ORIGINS', {
      infer: true,
    })!;
    return origins.split(',').map((origin) => origin.trim());
  }

  // Redis Configuration (Optional)
  // static get REDIS_HOST(): string | undefined {
  //   EnvConfig.ensureInitialized();
  //   return EnvConfig.configService.get('REDIS_HOST', { infer: true });
  // }

  // static get REDIS_PORT(): number {
  //   EnvConfig.ensureInitialized();
  //   return EnvConfig.configService.get('REDIS_PORT', { infer: true })!;
  // }

  // static get REDIS_PASSWORD(): string | undefined {
  //   EnvConfig.ensureInitialized();
  //   return EnvConfig.configService.get('REDIS_PASSWORD', { infer: true });
  // }

  // Email Configuration (Optional)
  // static get SMTP_HOST(): string | undefined {
  //   EnvConfig.ensureInitialized();
  //   return EnvConfig.configService.get('SMTP_HOST', { infer: true });
  // }

  // static get SMTP_PORT(): number {
  //   EnvConfig.ensureInitialized();
  //   return EnvConfig.configService.get('SMTP_PORT', { infer: true })!;
  // }

  // static get SMTP_USER(): string | undefined {
  //   EnvConfig.ensureInitialized();
  //   return EnvConfig.configService.get('SMTP_USER', { infer: true });
  // }

  // static get SMTP_PASS(): string | undefined {
  //   EnvConfig.ensureInitialized();
  //   return EnvConfig.configService.get('SMTP_PASS', { infer: true });
  // }

  // Security Settings
  static get BCRYPT_ROUNDS(): number {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('BCRYPT_ROUNDS', { infer: true })!;
  }

  // Rate Limiting
  static get RATE_LIMIT_TTL(): number {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('RATE_LIMIT_TTL', { infer: true })!;
  }

  static get RATE_LIMIT_MAX(): number {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('RATE_LIMIT_MAX', { infer: true })!;
  }

  // File Upload Settings
  static get MAX_FILE_SIZE(): number {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('MAX_FILE_SIZE', { infer: true })!;
  }

  // Logging Level
  static get LOG_LEVEL(): 'error' | 'warn' | 'info' | 'debug' | 'verbose' {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('LOG_LEVEL', { infer: true })!;
  }

  // External API Keys (Optional)
  static get EXTERNAL_API_KEY(): string | undefined {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('EXTERNAL_API_KEY', { infer: true });
  }

  // Health Check Settings
  static get HEALTH_CHECK_ENABLED(): boolean {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('HEALTH_CHECK_ENABLED', {
      infer: true,
    })!;
  }

  static get HEALTH_CHECK_DATABASE(): boolean {
    EnvConfig.ensureInitialized();
    return EnvConfig.configService.get('HEALTH_CHECK_DATABASE', {
      infer: true,
    })!;
  }

  // Environment Helper Methods
  static isDevelopment(): boolean {
    return EnvConfig.NODE_ENV === 'development';
  }

  static isProduction(): boolean {
    return EnvConfig.NODE_ENV === 'production';
  }

  static isTest(): boolean {
    return EnvConfig.NODE_ENV === 'test';
  }

  /**
   * Get all environment variables as an object (for debugging)
   * Excludes sensitive information in production
   */
  static getAllConfig(): Partial<EnvironmentVariables> {
    EnvConfig.ensureInitialized();

    const config: Partial<EnvironmentVariables> = {
      NODE_ENV: EnvConfig.NODE_ENV,
      PORT: EnvConfig.PORT,
      ALLOWED_ORIGINS: EnvConfig.ALLOWED_ORIGINS.join(','),
      RATE_LIMIT_TTL: EnvConfig.RATE_LIMIT_TTL,
      RATE_LIMIT_MAX: EnvConfig.RATE_LIMIT_MAX,
      MAX_FILE_SIZE: EnvConfig.MAX_FILE_SIZE,
      LOG_LEVEL: EnvConfig.LOG_LEVEL,
      HEALTH_CHECK_ENABLED: EnvConfig.HEALTH_CHECK_ENABLED,
      HEALTH_CHECK_DATABASE: EnvConfig.HEALTH_CHECK_DATABASE,
    };

    // Only include non-sensitive config in development
    if (EnvConfig.isDevelopment()) {
      config.DATABASE_URL = EnvConfig.DATABASE_URL.replace(
        /(:\/\/)[^:]+:[^@]+(@)/,
        '$1***:***$2',
      ); // Hide credentials
      config.REDIS_HOST = EnvConfig.REDIS_HOST;
      config.REDIS_PORT = EnvConfig.REDIS_PORT;
      config.SMTP_HOST = EnvConfig.SMTP_HOST;
      config.SMTP_PORT = EnvConfig.SMTP_PORT;
      config.SMTP_USER = EnvConfig.SMTP_USER;
    }

    return config;
  }

  /**
   * Validate required environment variables are present
   * Throws an error if any required variable is missing
   */
  static validate(): void {
    const requiredVars = [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
    ];

    const missing: string[] = [];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}. ` +
          'Please check your .env file and ensure all required variables are set.',
      );
    }

    // Validate JWT secret lengths
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters long for security.',
      );
    }

    if (
      process.env.JWT_REFRESH_SECRET &&
      process.env.JWT_REFRESH_SECRET.length < 32
    ) {
      throw new Error(
        'JWT_REFRESH_SECRET must be at least 32 characters long for security.',
      );
    }
  }

  /**
   * Get database connection info (without credentials)
   */
  static getDatabaseInfo(): {
    host: string;
    port: string;
    database: string;
    hasCredentials: boolean;
  } {
    const url = EnvConfig.DATABASE_URL;
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parsed.port || '5432',
        database: parsed.pathname.replace('/', ''),
        hasCredentials: !!(parsed.username && parsed.password),
      };
    } catch {
      return {
        host: 'Unknown',
        port: 'Unknown',
        database: 'Unknown',
        hasCredentials: false,
      };
    }
  }

  /**
   * Get a summary of the current configuration (safe for logging)
   */
  static getConfigSummary(): {
    environment: string;
    port: number;
    database: { host: string; port: string; database: string };
    security: {
      jwtConfigured: boolean;
      corsOrigins: number;
      rateLimitEnabled: boolean;
    };
    features: {
      healthCheck: boolean;
      redis: boolean;
      smtp: boolean;
    };
  } {
    const dbInfo = EnvConfig.getDatabaseInfo();

    return {
      environment: EnvConfig.NODE_ENV,
      port: EnvConfig.PORT,
      database: {
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
      },
      security: {
        jwtConfigured: !!(EnvConfig.JWT_SECRET && EnvConfig.JWT_REFRESH_SECRET),
        corsOrigins: EnvConfig.ALLOWED_ORIGINS.length,
        rateLimitEnabled: EnvConfig.RATE_LIMIT_MAX > 0,
      },
      features: {
        healthCheck: EnvConfig.HEALTH_CHECK_ENABLED,
        redis: !!EnvConfig.REDIS_HOST,
        smtp: !!EnvConfig.SMTP_HOST,
      },
    };
  }
}
