// src/common/filters/i18n-exception.filter.ts - CLEAN VERSION
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { LanguageService } from '../../i18n/services/language.service';
import {
  getDefaultLanguage,
  SupportedLanguage,
} from '../../i18n/constants/languages';

@Catch()
export class I18nExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(I18nExceptionFilter.name);

  constructor(private readonly languageService: LanguageService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<
      FastifyRequest & { detectedLanguage?: SupportedLanguage }
    >();
    const response = ctx.getResponse<FastifyReply>();

    // Determine language for error messages
    const language = request.detectedLanguage || getDefaultLanguage();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = this.translateMessage(exceptionResponse, language);
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as any;
        message = this.translateMessage(
          responseObj.message || responseObj.error || message,
          language,
        );
        errorCode =
          responseObj.errorCode || this.getErrorCodeFromStatus(status);
      }
    } else if (exception instanceof Error) {
      message = this.translateMessage(exception.message, language);
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
      );
    } else {
      message = this.translateMessage('An unexpected error occurred', language);
      this.logger.error('Unknown exception type:', exception);
    }

    // ✅ CLEAN: Standardized error response without technical details
    const errorResponse = {
      success: false,
      statusCode: status,
      error: errorCode,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      language: language,
      // ✅ CLEAN: Only include helpful details, not stack traces
      ...(this.shouldIncludeHelpfulDetails(status) && {
        details: this.getHelpfulDetails(status, errorCode),
      }),
    };

    // Log error details for monitoring
    this.logError(request, status, message, exception);

    response.status(status).send(errorResponse);
  }

  /**
   * ✅ NEW: Get helpful details for users (not technical stack traces)
   */
  private getHelpfulDetails(status: number, errorCode: string): any {
    const helpfulDetails: Record<string, any> = {
      400: {
        hint: 'Please check your request data and try again',
        documentation: '/docs/api-errors#bad-request',
      },
      401: {
        hint: 'Please login or provide a valid authentication token',
        documentation: '/docs/authentication',
      },
      403: {
        hint: 'You do not have permission to perform this action',
        documentation: '/docs/permissions',
      },
      404: {
        hint: 'The requested resource was not found',
        documentation: '/docs/api-errors#not-found',
      },
      409: {
        hint: 'This resource already exists or conflicts with existing data',
        actions: [
          'Try with different data',
          'Check if resource already exists',
        ],
      },
      422: {
        hint: 'Please check your input data format and try again',
        documentation: '/docs/validation-rules',
      },
      429: {
        hint: 'You are making too many requests. Please wait and try again',
        retryAfter: '60 seconds',
      },
      500: {
        hint: 'A server error occurred. Please try again later',
        supportContact: 'support@example.com',
      },
    };

    return (
      helpfulDetails[status] || {
        hint: 'An error occurred. Please try again or contact support',
      }
    );
  }

  /**
   * ✅ NEW: Determine when to include helpful details
   */
  private shouldIncludeHelpfulDetails(status: number): boolean {
    // Include helpful details for client errors and some server errors
    return (
      (status >= 400 && status < 500) || // Client errors
      status === 500 // Internal server error
    );
  }

  /**
   * Translate error message using language service
   */
  private translateMessage(
    message: string,
    language: SupportedLanguage,
  ): string {
    try {
      // Try to translate the message
      const translated = this.languageService.translate(message, language);

      // If translation returns the same key, try common error patterns
      if (translated === message) {
        return this.translateCommonErrors(message, language);
      }

      return translated;
    } catch (error) {
      this.logger.warn(`Translation failed for message: ${message}`, error);
      return message;
    }
  }

  /**
   * Translate common error patterns
   */
  private translateCommonErrors(
    message: string,
    language: SupportedLanguage,
  ): string {
    const commonErrorKeys = {
      Unauthorized: 'auth.messages.unauthorized',
      Forbidden: 'auth.messages.forbidden',
      'Not Found': 'common.messages.notFound',
      'Bad Request': 'common.messages.badRequest',
      'Internal Server Error': 'common.messages.internalError',
      'Validation failed': 'validation.messages.failed',
      'Invalid credentials': 'auth.messages.invalidCredentials',
      'Email already exists': 'validation.email.alreadyExists',
      'Email is already registered': 'validation.email.alreadyExists',
    };

    const errorKey = commonErrorKeys[message];
    if (errorKey) {
      try {
        const translated = this.languageService.translate(errorKey, language);
        return translated !== errorKey ? translated : message;
      } catch {
        return message;
      }
    }

    return message;
  }

  /**
   * Get error code from HTTP status
   */
  private getErrorCodeFromStatus(status: number): string {
    const statusCodes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return statusCodes[status] || 'UNKNOWN_ERROR';
  }

  /**
   * ✅ IMPROVED: Smart logging based on error severity
   */
  private logError(
    request: FastifyRequest,
    status: number,
    message: string,
    exception: unknown,
  ): void {
    const { method, url } = request;
    const userAgent = request.headers['user-agent'] || '';
    const ip = request.ip || 'unknown';

    const baseLog = {
      method,
      url,
      status,
      ip,
      userAgent: userAgent.substring(0, 100),
    };

    if (status >= 500) {
      // Server errors - full logging
      this.logger.error(
        `Server Error: ${method} ${url} ${status} - ${message}`,
        {
          ...baseLog,
          exception: exception instanceof Error ? exception.stack : exception,
        },
      );
    } else if (status === 401 || status === 403) {
      // Auth errors - minimal logging (no sensitive data)
      this.logger.warn(`Auth Error: ${method} ${url} ${status}`, {
        method,
        url,
        status,
        ip,
      });
    } else if (status >= 400) {
      // Other client errors - moderate logging
      this.logger.warn(
        `Client Error: ${method} ${url} ${status} - ${message}`,
        baseLog,
      );
    }
  }
}
