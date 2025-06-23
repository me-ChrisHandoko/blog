// src/common/interceptors/error-response.interceptor.ts - PRODUCTION READY
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LanguageService } from '../../i18n/services/language.service';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../../i18n/constants/languages';

@Injectable()
export class ErrorResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorResponseInterceptor.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(private readonly languageService: LanguageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const lang: SupportedLanguage =
      request.detectedLanguage || getDefaultLanguage();

    return next.handle().pipe(
      catchError((error) => {
        if (error instanceof HttpException) {
          const status = error.getStatus();
          const exceptionResponse = error.getResponse();
          let message: string | string[];

          if (typeof exceptionResponse === 'string') {
            message = this.translateIfNeeded(exceptionResponse, lang);
          } else if (
            typeof exceptionResponse === 'object' &&
            exceptionResponse !== null
          ) {
            const resp = exceptionResponse as any;
            if (resp.message) {
              if (Array.isArray(resp.message)) {
                message = resp.message.map((msg: string) =>
                  this.translateIfNeeded(msg, lang),
                );
              } else {
                message = this.translateIfNeeded(resp.message, lang);
              }
            } else {
              message = this.translateIfNeeded('common.messages.error', lang);
            }
          } else {
            message = this.translateIfNeeded('common.messages.error', lang);
          }

          // Log for internal monitoring
          this.logError(status, message, request, error);

          // ✅ PRODUCTION: Create clean, minimal response
          const errorResponse = this.createErrorResponse(
            status,
            message,
            request,
            lang,
          );

          throw new HttpException(errorResponse, status);
        }

        return throwError(() => error);
      }),
    );
  }

  /**
   * ✅ PRODUCTION: Create appropriate error response based on environment
   */
  private createErrorResponse(
    status: number,
    message: string | string[],
    request: any,
    lang: SupportedLanguage,
  ): any {
    // Base response (always included)
    const baseResponse = {
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    };

    if (this.isProduction) {
      // ✅ PRODUCTION: Minimal response for security
      return {
        ...baseResponse,
        error: this.getSimpleErrorCode(status),
        // Only include essential info in production
        ...(this.shouldIncludeRequestInfo(status) && {
          path: this.sanitizePath(request.url),
        }),
      };
    } else {
      // ✅ DEVELOPMENT: More detailed response for debugging
      return {
        ...baseResponse,
        error: this.getDetailedErrorCode(status),
        path: request.url,
        method: request.method,
        language: lang,
        // Include helpful details only in development
        ...(this.shouldIncludeDevDetails(status) && {
          details: this.getDevDetails(status),
        }),
      };
    }
  }

  /**
   * ✅ PRODUCTION: Determine if request info should be included
   */
  private shouldIncludeRequestInfo(status: number): boolean {
    // In production, only include path for client errors that benefit from it
    return status === 404 || status === 400 || status === 422;
  }

  /**
   * ✅ PRODUCTION: Sanitize path to remove sensitive params
   */
  private sanitizePath(path: string): string {
    // Remove query parameters and sensitive path segments
    const cleanPath = path.split('?')[0];

    // Replace UUIDs and IDs with placeholders for privacy
    return cleanPath
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-zA-Z0-9]{20,}/g, '/:token');
  }

  /**
   * ✅ PRODUCTION: Simple error codes for production
   */
  private getSimpleErrorCode(status: number): string {
    if (status >= 400 && status < 500) return 'CLIENT_ERROR';
    if (status >= 500) return 'SERVER_ERROR';
    return 'ERROR';
  }

  /**
   * ✅ DEVELOPMENT: Detailed error codes for development
   */
  private getDetailedErrorCode(status: number): string {
    const errorCodes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return errorCodes[status] || 'UNKNOWN_ERROR';
  }

  /**
   * ✅ DEVELOPMENT: Should include development details
   */
  private shouldIncludeDevDetails(status: number): boolean {
    return status === 400 || status === 422 || status === 500;
  }

  /**
   * ✅ DEVELOPMENT: Development-only helpful details
   */
  private getDevDetails(status: number): any {
    const devDetails = {
      400: {
        hint: 'Check request format and required fields',
        docs: '/docs/api-reference',
      },
      422: {
        hint: 'Validation failed - check field requirements',
        docs: '/docs/validation-rules',
      },
      500: {
        hint: 'Server error - check logs for details',
        support: 'dev-team@company.com',
      },
    };
    return devDetails[status];
  }

  /**
   * ✅ IMPROVED: Smart logging based on environment and error type
   */
  private logError(
    status: number,
    message: string | string[],
    request: any,
    error: Error,
  ) {
    const logContext = {
      statusCode: status,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent']?.substring(0, 100),
      ip: request.ip,
      userId: request.user?.id,
    };

    if (this.isProduction) {
      // ✅ PRODUCTION: Minimal logging for privacy
      if (status >= 500) {
        // Server errors - log for monitoring
        this.logger.error(`Server Error: ${status}`, {
          statusCode: status,
          method: request.method,
          path: this.sanitizePath(request.url),
          errorType: error.name,
          userId: request.user?.id,
        });
      } else if (status === 401 || status === 403) {
        // Auth errors - minimal security logging
        this.logger.warn(`Auth Error: ${status}`, {
          statusCode: status,
          ip: request.ip,
          path: this.sanitizePath(request.url),
        });
      }
      // Don't log business logic errors (400, 409, 422) in production
    } else {
      // ✅ DEVELOPMENT: Detailed logging for debugging
      const logMessage = `${status} - ${JSON.stringify(message)} - ${request.method} ${request.url}`;

      if (status >= 500) {
        this.logger.error(`Server Error: ${logMessage}`, {
          ...logContext,
          stack: error.stack,
        });
      } else if (status >= 400) {
        this.logger.warn(`Client Error: ${logMessage}`, logContext);
      }
    }
  }

  private translateIfNeeded(text: string, lang: SupportedLanguage): string {
    if (
      text &&
      text.includes('.') &&
      (text.startsWith('validation.') ||
        text.startsWith('auth.') ||
        text.startsWith('common.') ||
        text.startsWith('users.'))
    ) {
      return this.languageService.translate(text, lang);
    }
    return text;
  }
}
