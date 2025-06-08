import { Controller, Get, Headers, Query } from '@nestjs/common';
import { LanguageService } from '../i18n/services/language.service';
// import { CurrentLanguage } from 'src/i18n/decorators/current-laguage.decorator';
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
  ) {
    const detectedLanguage = this.languageService.detectLanguageFromSources({
      query: queryLang,
      header: headerLang,
      acceptLanguage: acceptLang,
    });

    return {
      detected: detectedLanguage,
      sources: {
        query: queryLang,
        header: headerLang,
        acceptLanguage: acceptLang,
      },
      metadata: this.languageService.getLanguageMetadata(detectedLanguage),
    };
  }

  /**
   * Test translation system
   * GET /test/translation?key=users.messages.created&lang=en
   */
  @Get('translation')
  testTranslation(
    @Query('key') key: string = 'users.messages.created',
    @Query('lang') lang: string,
  ) {
    const supportedLang = this.languageService.validateLanguage(lang);
    const translation = this.languageService.translate(key, supportedLang);
    const hasTranslation = this.languageService.hasTranslation(
      key,
      supportedLang,
    );
    const allSupportedLanguage = this.languageService.getSupportedLanguages();

    return {
      key,
      requestedLanguage: lang,
      detectedLanguage: supportedLang,
      translation: translation,
      hasTranslation: hasTranslation,
      allSupportedLanguages: allSupportedLanguage,
    };
  }

  /**
   * Test translation with arguments
   * GET /test/translation-args?lang=en
   */
  @Get('translation-args')
  testTranslationWithArgs(@Query('lang') lang: string = 'id') {
    const supportedLang = this.languageService.validateLanguage(lang);

    const testCases = [
      {
        key: 'validation.generic.tooShort',
        args: { field: 'Password', min: 8 },
      },
      {
        key: 'validation.generic.tooLong',
        args: { field: 'Name', max: 50 },
      },
      {
        key: 'validation.language.unsupported',
        args: { languages: 'ID, EN, ZH' },
      },
    ];

    return {
      language: supportedLang,
      testCases: testCases.map((testCase) => ({
        ...testCase,
        result: this.languageService.translate(
          testCase.key,
          supportedLang,
          testCase.args,
        ),
      })),
    };
  }

  /**
   * Test all available translations
   * GET /test/all-translations?lang=en
   */
  @Get('all-translations')
  testAllTranslations(@Query('lang') lang: string = 'id') {
    const supportedLang = this.languageService.validateLanguage(lang);
    const availableKeys =
      this.languageService.getAvailableTranslations(supportedLang);

    return {
      language: supportedLang,
      totalTranslations: availableKeys.length,
      sampleTranslations: availableKeys.slice(0, 10).reduce(
        (acc, key) => {
          acc[key] = this.languageService.translate(key, supportedLang);
          return acc;
        },
        {} as Record<string, string>,
      ),
      allKeys: availableKeys,
    };
  }

  /**
   * Test language metadata
   * GET /test/language-metadata
   */
  @Get('language-metadata')
  testLanguageMetadata() {
    return {
      supportedLanguage:
        this.languageService.getSupportedLanguagesWithMetadata(),
      defaultLanguage: this.languageService.getDefaultLanguage(),
    };
  }

  /**
   * Test Prisma language conversion
   * GET /test/language-conversion
   */
  @Get('language-conversion')
  testLanguageConversion() {
    const testCases = [
      { supported: SupportedLanguage.INDONESIAN, prisma: 'ID' },
      { supported: SupportedLanguage.ENGLISH, prisma: 'EN' },
      { supported: SupportedLanguage.CHINESE, prisma: 'ZH' },
    ];

    return {
      conversionTest: testCases.map((testCase) => ({
        original: testCase,
        supportedToPrisma: this.languageService.supportedToPrisma(
          testCase.supported,
        ),
        prismaToSupported: this.languageService.prismaToSupported(
          testCase.prisma,
        ),
        isValid: this.languageService.isSupported(testCase.supported),
      })),
    };
  }
}
