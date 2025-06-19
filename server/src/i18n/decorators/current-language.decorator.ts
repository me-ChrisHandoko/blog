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
