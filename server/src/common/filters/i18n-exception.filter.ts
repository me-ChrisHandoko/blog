import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { LanguageService } from '../../i18n/services/language.service';
import { SupportedLanguage } from '../../i18n/constants/languages';

@Catch(BadRequestException)
@Injectable()
export class I18nExceptionFilter implements ExceptionFilter {
  constructor(private readonly languageService: LanguageService) {}

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest();

    // Get detected language dari request (set oleh LanguageGuard)
    const language: SupportedLanguage =
      request.detectedLanguage || this.languageService.getDefaultLanguage();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    let translatedMessage = exceptionResponse.message;

    // Jika message adalah array (validation errors)
    if (Array.isArray(exceptionResponse.message)) {
      translatedMessage = exceptionResponse.message.map(
        (messageKey: string) => {
          // Cek apakah ini translation key atau sudah plain message
          if (this.languageService.hasTranslation(messageKey, language)) {
            return this.languageService.translate(messageKey, language);
          }
          return messageKey; // Return as-is jika bukan translation key
        },
      );
    }
    // Jika message adalah string tunggal
    else if (typeof exceptionResponse.message === 'string') {
      if (
        this.languageService.hasTranslation(exceptionResponse.message, language)
      ) {
        translatedMessage = this.languageService.translate(
          exceptionResponse.message,
          language,
        );
      }
    }

    // Format response yang konsisten
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      language: language,
      message: translatedMessage,
      error: exceptionResponse.error || 'Bad Request',
    };

    response.status(status).send(errorResponse);
  }
}
