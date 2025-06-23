// src/users/services/user-validation.service.ts - NEW VALIDATION SERVICE
import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import { SupportedLanguage } from '../../i18n/constants/languages';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserValidationService {
  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {}

  /**
   * Validate email uniqueness
   */
  async validateEmailUnique(
    email: string,
    lang: SupportedLanguage,
    excludeUserId?: string,
  ): Promise<void> {
    const existingUser = await this.database.monitoredQuery(async () => {
      return await this.database.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
      });
    }, 'validate-email-unique');

    if (existingUser && existingUser.id !== excludeUserId) {
      throw new ConflictException(
        this.languageService.translate('users.messages.emailExists', lang),
      );
    }
  }

  /**
   * Hash password with bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password
   */
  async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }

    // Minimal 8 karakter
    if (password.length < 8) {
      return false;
    }

    // Harus mengandung: huruf besar, huruf kecil, angka, dan simbol
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[@$!%*?&]/.test(password);

    return hasLowercase && hasUppercase && hasNumbers && hasSymbols;
  }

  /**
   * Validate profile translations
   */
  validateProfileTranslations(
    translations: any[],
    lang: SupportedLanguage,
  ): void {
    if (!translations || translations.length === 0) {
      throw new BadRequestException(
        this.languageService.translate(
          'users.messages.profileTranslationRequired',
          lang,
        ),
      );
    }

    // Check for duplicate languages
    const languages = translations.map((t) => t.language);
    const uniqueLanguages = new Set(languages);

    if (languages.length !== uniqueLanguages.size) {
      throw new BadRequestException(
        this.languageService.translate(
          'users.messages.duplicateLanguages',
          lang,
        ),
      );
    }

    // Validate each translation
    for (const translation of translations) {
      if (!translation.firstName || !translation.lastName) {
        throw new BadRequestException(
          this.languageService.translate('validation.name.required', lang),
        );
      }

      if (translation.firstName.length < 2 || translation.lastName.length < 2) {
        throw new BadRequestException(
          this.languageService.translate('validation.name.tooShort', lang),
        );
      }
    }
  }
}

// src/shared/utils/error-response.builder.ts - UPDATED
import { HttpStatus } from '@nestjs/common';

export interface ErrorRequest {
  url: string;
  method: string;
}

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error: string;
}

export class ErrorResponseBuilder {
  /**
   * Build standardized error response
   */
  static build(
    status: number,
    message: string | string[],
    request: ErrorRequest,
    error?: string,
  ): ErrorResponse {
    return {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error: error || this.getErrorName(status),
    };
  }

  /**
   * Get error name from HTTP status code
   */
  static getErrorName(status: number): string {
    const errorNames: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    };

    return errorNames[status] || 'Error';
  }

  /**
   * Build validation error response
   */
  static buildValidationError(
    validationErrors: string[],
    request: ErrorRequest,
  ): ErrorResponse {
    return this.build(
      HttpStatus.BAD_REQUEST,
      validationErrors,
      request,
      'Validation Error',
    );
  }

  /**
   * Build authorization error response
   */
  static buildAuthError(
    request: ErrorRequest,
    message?: string,
  ): ErrorResponse {
    return this.build(
      HttpStatus.UNAUTHORIZED,
      message || 'Authentication required',
      request,
      'Unauthorized',
    );
  }

  /**
   * Build forbidden error response
   */
  static buildForbiddenError(
    request: ErrorRequest,
    message?: string,
  ): ErrorResponse {
    return this.build(
      HttpStatus.FORBIDDEN,
      message || 'Access denied',
      request,
      'Forbidden',
    );
  }

  /**
   * Build not found error response
   */
  static buildNotFoundError(
    request: ErrorRequest,
    resource?: string,
  ): ErrorResponse {
    const message = resource ? `${resource} not found` : 'Resource not found';
    return this.build(HttpStatus.NOT_FOUND, message, request, 'Not Found');
  }

  /**
   * Build rate limit error response
   */
  static buildRateLimitError(
    request: ErrorRequest,
    retryAfter?: number,
  ): ErrorResponse & { retryAfter?: number } {
    const response = this.build(
      HttpStatus.TOO_MANY_REQUESTS,
      'Rate limit exceeded. Please try again later.',
      request,
      'Too Many Requests',
    );

    return {
      ...response,
      ...(retryAfter && { retryAfter }),
    };
  }
}

// src/common/types/api-response.types.ts - ENHANCED
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  timestamp: string;
  version: string;
  language: string;
  requestId?: string;
  executionTime?: number;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version?: string;
  environment?: string;
  services?: Record<string, ServiceHealth>;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  details?: any;
  lastCheck?: string;
}

// Response builder utility
export class ApiResponseBuilder {
  /**
   * Build success response
   */
  static success<T>(
    data: T,
    message?: string,
    meta?: Partial<ResponseMeta>,
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        language: 'en',
        ...meta,
      },
    };
  }

  /**
   * Build error response
   */
  static error(
    message: string,
    errors?: string[],
    meta?: Partial<ResponseMeta>,
  ): ApiResponse {
    return {
      success: false,
      message,
      errors,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        language: 'en',
        ...meta,
      },
    };
  }

  /**
   * Build paginated response
   */
  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
    message?: string,
    meta?: Partial<ResponseMeta>,
  ): PaginatedApiResponse<T> {
    return {
      success: true,
      data,
      message,
      pagination,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        language: 'en',
        ...meta,
      },
    };
  }
}

// src/common/decorators/api-response.decorator.ts - NEW
import { applyDecorators } from '@nestjs/common';
import { ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';

export function ApiSuccessResponse(options: {
  description: string;
  type?: any;
  status?: number;
}) {
  return applyDecorators(
    SwaggerApiResponse({
      status: options.status || 200,
      description: options.description,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: options.type
            ? { $ref: '#/components/schemas/' + options.type.name }
            : { type: 'object' },
          message: { type: 'string' },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string' },
              language: { type: 'string' },
            },
          },
        },
      },
    }),
  );
}

export function ApiErrorResponse(options: {
  description: string;
  status: number;
}) {
  return applyDecorators(
    SwaggerApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errors: { type: 'array', items: { type: 'string' } },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string' },
              language: { type: 'string' },
            },
          },
        },
      },
    }),
  );
}

export function ApiPaginatedResponse(options: {
  description: string;
  type: any;
}) {
  return applyDecorators(
    SwaggerApiResponse({
      status: 200,
      description: options.description,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/' + options.type.name },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              limit: { type: 'number' },
              total: { type: 'number' },
              totalPages: { type: 'number' },
              hasNext: { type: 'boolean' },
              hasPrev: { type: 'boolean' },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string' },
              language: { type: 'string' },
            },
          },
        },
      },
    }),
  );
}

// src/common/guards/index.ts - EXPORTS
export { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
export { RolesGuard } from '../../auth/guards/roles.guard';
export { LanguageGuard } from '../../i18n/guards/language.guard';

// src/common/filters/index.ts - EXPORTS
export { HttpExceptionFilter } from './http-exception.filter';
export { I18nExceptionFilter } from './i18n-exception.filter';

// src/common/interceptors/index.ts - COMPLETE EXPORTS
export { LoggingInterceptor } from './logging.interceptor';
export { PerformanceInterceptor } from './performance.interceptor';
export { RequestIdInterceptor } from './request-id.interceptor';
export { ErrorResponseInterceptor } from './error-response.interceptor';
export { TimeoutInterceptor } from './timeout.interceptor';

// src/common/utils/index.ts - UTILITY EXPORTS
export { ErrorResponseBuilder } from '../shared/utils/error-response.builder';
export { LanguageConverter } from '../shared/utils/language-converter';
export { ApiResponseBuilder } from './api-response.types';

// src/common/index.ts - MAIN EXPORTS
export * from './cache';
export * from './dto';
export * from './exceptions';
export * from './filters';
export * from './interceptors';
export * from './services';
export * from './types';
export * from './decorators';
export * from './guards';
export * from './utils';
