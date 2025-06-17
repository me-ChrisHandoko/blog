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

          // Create structured error response
          const errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            message,
            error: this.getErrorName(status),
          };

          // IMPROVED: Different log levels for different types of errors
          this.logError(status, message, request, error);

          // Throw new exception with structured response
          throw new HttpException(errorResponse, status);
        }

        return throwError(() => error);
      }),
    );
  }

  private logError(
    status: number,
    message: string | string[],
    request: any,
    error: Error,
  ) {
    const logMessage = `${status} - ${JSON.stringify(message)} - ${request.method} ${request.url}`;

    if (this.isExpectedError(status)) {
      // Expected business logic errors - log as INFO or WARN, not ERROR
      if (this.isClientError(status)) {
        this.logger.warn(`Client Error: ${logMessage}`);
      } else {
        this.logger.log(`Business Logic: ${logMessage}`);
      }
    } else {
      // Unexpected server errors - log as ERROR
      this.logger.error(`Server Error: ${logMessage}`, error.stack);
    }
  }

  private isExpectedError(status: number): boolean {
    // These are expected business logic errors, not system failures
    const expectedStatuses = [
      HttpStatus.BAD_REQUEST, // 400 - Validation errors
      HttpStatus.UNAUTHORIZED, // 401 - Invalid credentials
      HttpStatus.FORBIDDEN, // 403 - Permission denied
      HttpStatus.NOT_FOUND, // 404 - Resource not found
      HttpStatus.CONFLICT, // 409 - Email already exists, etc.
      HttpStatus.UNPROCESSABLE_ENTITY, // 422 - Business rule violations
    ];

    return expectedStatuses.includes(status);
  }

  private isClientError(status: number): boolean {
    return status >= 400 && status < 500;
  }

  private translateIfNeeded(text: string, lang: SupportedLanguage): string {
    if (
      text &&
      text.includes('.') &&
      (text.startsWith('validation.') ||
        text.startsWith('auth.') ||
        text.startsWith('common.'))
    ) {
      return this.languageService.translate(text, lang);
    }
    return text;
  }

  private getErrorName(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Unprocessable Entity';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';
      default:
        return 'Error';
    }
  }
}
