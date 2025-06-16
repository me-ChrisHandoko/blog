import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SupportedLanguage, getDefaultLanguage } from '../constants/languages';

/**
 * Decorator untuk mengextract bahasa yang terdeteksi dari request
 *
 * Usage di controller:
 * @Get()
 * findAll(@CurrentLanguage() lang: SupportedLanguage) {
 *   // lang sudah berisi bahasa yang terdeteksi
 * }
 */
export const CurrentLanguage = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SupportedLanguage => {
    const request = ctx.switchToHttp().getRequest();
    return request.detectedLanguage || getDefaultLanguage();
  },
);

/**
 * Decorator untuk mendapatkan language service instance
 * Berguna untuk translation langsung di controller
 */
export const Translate = createParamDecorator(
  (translationKey: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const language = request.detectedLanguage || getDefaultLanguage();

    // Return function yang bisa dipanggil dengan args
    return (args?: Record<string, any>) => {
      // Akan diimplementasi dengan I18nService injection
      return translationKey; // Placeholder
    };
  },
);
