// src/test/test.controller.ts - Updated to work with enhanced LanguageService
import { Controller, Get, Headers, Query } from '@nestjs/common';
import { LanguageService } from '../i18n/services/language.service';
import { CurrentLanguage } from '../i18n/decorators/current-language.decorator';
import { SupportedLanguage } from '../i18n/constants/languages';

@Controller('test')
export class TestController {
  constructor(private readonly languageService: LanguageService) {}

  /**
   * Test language detection
   * GET /test/language?lang=en
   * Headers: X-Language: id
   */
  @Get('language')
  testLanguageDetection(
    @Query('lang') queryLang?: string,
    @Headers('x-language') headerLang?: string,
    @Headers('accept-language') acceptLang?: string,
    @CurrentLanguage() currentLang?: SupportedLanguage,
  ) {
    const detectedLanguage = this.languageService.detectLanguageFromSources({
      query: queryLang,
      header: headerLang,
      acceptLanguage: acceptLang,
    });

    return {
      detected: detectedLanguage,
      fromDecorator: currentLang,
      sources: {
        query: queryLang,
        header: headerLang,
        acceptLanguage: acceptLang,
      },
      metadata: this.languageService.getLanguageMetadata(detectedLanguage),
      displayName: this.languageService.getDisplayName(detectedLanguage),
    };
  }

  /**
   * Test translation system
   * GET /test/translation?key=users.messages.created&lang=en
   */
  @Get('translation')
  testTranslation(
    @Query('key') key: string = 'users.messages.created',
    @Query('lang') lang: string = 'id',
  ) {
    const supportedLang = this.languageService.validateLanguage(lang);
    const translation = this.languageService.translate(key, supportedLang);
    const hasTranslation = this.languageService.hasTranslation(
      key,
      supportedLang,
    );
    const allSupportedLanguages = this.languageService.getSupportedLanguages();

    return {
      key,
      requestedLanguage: lang,
      detectedLanguage: supportedLang,
      translation: translation,
      hasTranslation: hasTranslation,
      allSupportedLanguages: allSupportedLanguages,
      metadata: this.languageService.getLanguageMetadata(supportedLang),
    };
  }
}
