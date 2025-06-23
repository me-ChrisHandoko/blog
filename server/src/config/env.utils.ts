import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';

export class EnvConfig {
  private static configService: ConfigService<EnvironmentVariables>;

  static initialize(configService: ConfigService<EnvironmentVariables>) {
    this.configService = configService;
  }

  static get NODE_ENV(): string {
    return this.configService?.get('NODE_ENV') || 'development';
  }

  static get PORT(): number {
    return this.configService?.get('PORT') || 3001;
  }

  static get DATABASE_URL(): string {
    return this.configService?.get('DATABASE_URL') || '';
  }

  static get JWT_SECRET(): string {
    return this.configService?.get('JWT_SECRET') || '';
  }

  static get JWT_REFRESH_SECRET(): string {
    return this.configService?.get('JWT_REFRESH_SECRET') || '';
  }

  static get ALLOWED_ORIGINS(): string[] {
    const origins =
      this.configService?.get('ALLOWED_ORIGINS') || 'http://localhost:3000';
    return origins.split(',').map((origin) => origin.trim());
  }

  static get RATE_LIMIT_TTL(): number {
    return this.configService?.get('RATE_LIMIT_TTL') || 60000;
  }

  static get RATE_LIMIT_MAX(): number {
    return this.configService?.get('RATE_LIMIT_MAX') || 100;
  }

  static isDevelopment(): boolean {
    return this.NODE_ENV === 'development';
  }

  static isProduction(): boolean {
    return this.NODE_ENV === 'production';
  }

  static isTest(): boolean {
    return this.NODE_ENV === 'test';
  }

  static getConfigSummary() {
    return {
      database: {
        host: 'configured',
        port: 'configured',
      },
      security: {
        jwtConfigured: !!this.JWT_SECRET,
        corsOrigins: this.ALLOWED_ORIGINS.join(', '),
        rateLimitEnabled: this.isProduction(),
      },
      features: {
        healthCheck: true,
        redis: false,
        smtp: false,
      },
    };
  }
}
