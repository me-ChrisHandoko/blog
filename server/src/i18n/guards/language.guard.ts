import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { LanguageService } from '../services/language.service';

/**
 * Guard untuk mendeteksi dan memvalidasi bahasa dari request
 *
 * Guard ini akan:
 * 1. Extract bahasa dari berbagai sumber (query, header, dll)
 * 2. Validasi bahasa yang didukung
 * 3. Set bahasa yang terdeteksi ke request object
 * 4. Provide fallback jika bahasa tidak valid
 */
@Injectable()
export class LanguageGuard implements CanActivate {
  constructor(private readonly languageService: LanguageService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract bahasa dari berbagai sumber
    const detectedLanguage = this.languageService.detectLanguageFromSources({
      query: request.query?.lang,
      header: request.headers['x-language'],
      acceptLanguage: request.headers['accept-language'],
      // TODO: Nanti bisa ditambah user preference dari JWT token
      userPreference: request.user?.preferredLanguage,
    });

    // Set bahasa yang terdeteksi ke request untuk digunakan di controller
    request.detectedLanguage = detectedLanguage;

    // Log untuk debugging (opsional)
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `🌐 Language detected: ${detectedLanguage} for ${request.method} ${request.url}`,
      );
    }

    return true;
  }
}
