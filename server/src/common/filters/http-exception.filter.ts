import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify'; // CHANGED: Import Fastify types
import { LanguageService } from '../../i18n/services/language.service';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../../i18n/constants/languages';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly languageService: LanguageService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>(); // CHANGED: Use FastifyReply
    const request = ctx.getRequest<FastifyRequest>(); // CHANGED: Use FastifyRequest
    const status = exception.getStatus();

    // Get language from request
    const lang: SupportedLanguage =
      (request as any).detectedLanguage || getDefaultLanguage();

    // Get exception response
    const exceptionResponse = exception.getResponse();
    let message: string | string[];

    // Handle different types of exception responses
    if (typeof exceptionResponse === 'string') {
      message = this.translateIfNeeded(exceptionResponse, lang);
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const response = exceptionResponse as any;

      if (response.message) {
        if (Array.isArray(response.message)) {
          // Handle validation pipe messages (array)
          message = response.message.map((msg: string) =>
            this.translateIfNeeded(msg, lang),
          );
        } else {
          message = this.translateIfNeeded(response.message, lang);
        }
      } else {
        message = this.translateIfNeeded('common.messages.error', lang);
      }
    } else {
      message = this.translateIfNeeded('common.messages.error', lang);
    }

    // Log the error for debugging
    this.logger.error(
      `HTTP Exception: ${status} - ${JSON.stringify(message)} - ${request.method} ${request.url}`,
      exception.stack,
    );

    // Create the response object
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error: this.getErrorName(status),
    };

    // FIXED: Use Fastify response methods
    response.status(status).send(errorResponse); // CHANGED: Use .send() instead of .json()
  }

  private translateIfNeeded(text: string, lang: SupportedLanguage): string {
    // Check if text looks like a translation key
    if (
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
