import * as Joi from 'joi';

/**
 * Environment Variables Validation Schema
 *
 * This schema validates all required environment variables at application startup.
 * If any required variable is missing or invalid, the application will fail to start.
 */
export const envValidationSchema = Joi.object({
  // Application Settings
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(3001),

  // Database Configuration
  DATABASE_URL: Joi.string()
    .uri()
    .required()
    .description('PostgreSQL connection string'),

  // JWT Configuration
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT access token secret (minimum 32 characters)'),

  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m')
    .description('JWT access token expiration (e.g., 15m, 1h, 1d)'),

  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT refresh token secret (minimum 32 characters)'),

  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d')
    .description('JWT refresh token expiration (e.g., 7d, 30d)'),

  // CORS Configuration
  ALLOWED_ORIGINS: Joi.string()
    .default('http://localhost:3000')
    .description('Comma-separated list of allowed CORS origins'),

  // Optional: Redis Configuration (if using Redis for caching)
  // REDIS_HOST: Joi.string().hostname().when('NODE_ENV', {
  //   is: 'production',
  //   then: Joi.required(),
  //   otherwise: Joi.optional(),
  // }),

  // REDIS_PORT: Joi.number().port().default(6379),

  // REDIS_PASSWORD: Joi.string().optional(),

  // Optional: Email Configuration (if using email service)
  // SMTP_HOST: Joi.string().hostname().optional(),

  // SMTP_PORT: Joi.number().port().default(587),

  // SMTP_USER: Joi.string().email().optional(),

  // SMTP_PASS: Joi.string().optional(),

  // Security Settings
  BCRYPT_ROUNDS: Joi.number()
    .integer()
    .min(10)
    .max(15)
    .default(12)
    .description('Bcrypt hashing rounds (10-15)'),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number()
    .integer()
    .positive()
    .default(60000)
    .description('Rate limit time window in milliseconds'),

  RATE_LIMIT_MAX: Joi.number()
    .integer()
    .positive()
    .default(100)
    .description('Maximum requests per time window'),

  // File Upload Settings
  MAX_FILE_SIZE: Joi.number()
    .integer()
    .positive()
    .default(5242880) // 5MB
    .description('Maximum file upload size in bytes'),

  // Logging Level
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),

  // Optional: External API Keys
  EXTERNAL_API_KEY: Joi.string()
    .optional()
    .description('External service API key'),

  // Health Check Settings
  HEALTH_CHECK_ENABLED: Joi.boolean().default(true),

  HEALTH_CHECK_DATABASE: Joi.boolean().default(true),
});

/**
 * Type definition for validated environment variables
 * This provides type safety when accessing env vars throughout the app
 */
export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  ALLOWED_ORIGINS: string;
  REDIS_HOST?: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  BCRYPT_ROUNDS: number;
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_MAX: number;
  MAX_FILE_SIZE: number;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  EXTERNAL_API_KEY?: string;
  HEALTH_CHECK_ENABLED: boolean;
  HEALTH_CHECK_DATABASE: boolean;
}
