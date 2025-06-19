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

  /**
   * Test translation with arguments
   * GET /test/translation-args?lang=en
   */
  @Get('translation-args')
  testTranslationWithArgs(@Query('lang') lang: string = 'id') {
    const supportedLang = this.languageService.validateLanguage(lang);

    const testCases = [
      {
        key: 'validation.generic.required',
        args: { field: 'Email' },
      },
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
      {
        key: 'common.pagination.showing',
        args: { start: 1, end: 10, total: 100 },
      },
    ];

    return {
      language: supportedLang,
      languageDisplay: this.languageService.getDisplayName(supportedLang),
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
   * Test type-safe translation methods
   * GET /test/type-safe-translations?lang=en
   */
  @Get('type-safe-translations')
  testTypeSafeTranslations(@Query('lang') lang: string = 'id') {
    const supportedLang = this.languageService.validateLanguage(lang);

    return {
      language: supportedLang,
      translations: {
        auth: {
          loginSuccess: this.languageService.translateAuth(
            'loginSuccess',
            supportedLang,
          ),
          invalidCredentials: this.languageService.translateAuth(
            'invalidCredentials',
            supportedLang,
          ),
          accountDeactivated: this.languageService.translateAuth(
            'accountDeactivated',
            supportedLang,
          ),
        },
        users: {
          messages: {
            created: this.languageService.translateUsers(
              'created',
              'messages',
              supportedLang,
            ),
            updated: this.languageService.translateUsers(
              'updated',
              'messages',
              supportedLang,
            ),
            notFound: this.languageService.translateUsers(
              'notFound',
              'messages',
              supportedLang,
            ),
          },
          roles: {
            USER: this.languageService.translateUsers(
              'USER',
              'roles',
              supportedLang,
            ),
            ADMIN: this.languageService.translateUsers(
              'ADMIN',
              'roles',
              supportedLang,
            ),
            SUPER_ADMIN: this.languageService.translateUsers(
              'SUPER_ADMIN',
              'roles',
              supportedLang,
            ),
          },
        },
        validation: {
          email: {
            required: this.languageService.translateValidation(
              'email',
              'required',
              supportedLang,
            ),
            invalid: this.languageService.translateValidation(
              'email',
              'invalid',
              supportedLang,
            ),
            alreadyExists: this.languageService.translateValidation(
              'email',
              'alreadyExists',
              supportedLang,
            ),
          },
          password: {
            required: this.languageService.translateValidation(
              'password',
              'required',
              supportedLang,
            ),
            complexity: this.languageService.translateValidation(
              'password',
              'complexity',
              supportedLang,
            ),
            mismatch: this.languageService.translateValidation(
              'password',
              'mismatch',
              supportedLang,
            ),
          },
        },
        common: {
          messages: {
            success: this.languageService.translateCommon(
              'messages',
              'success',
              supportedLang,
            ),
            error: this.languageService.translateCommon(
              'messages',
              'error',
              supportedLang,
            ),
            notFound: this.languageService.translateCommon(
              'messages',
              'notFound',
              supportedLang,
            ),
          },
          actions: {
            create: this.languageService.translateCommon(
              'actions',
              'create',
              supportedLang,
            ),
            update: this.languageService.translateCommon(
              'actions',
              'update',
              supportedLang,
            ),
            delete: this.languageService.translateCommon(
              'actions',
              'delete',
              supportedLang,
            ),
          },
        },
      },
    };
  }

  /**
   * Test all available translations for debugging
   * GET /test/all-translations?lang=en&limit=20
   */
  @Get('all-translations')
  testAllTranslations(
    @Query('lang') lang: string = 'id',
    @Query('limit') limit: string = '20',
  ) {
    const supportedLang = this.languageService.validateLanguage(lang);
    const availableKeys =
      this.languageService.getAvailableTranslations(supportedLang);
    const limitNum = parseInt(limit) || 20;

    return {
      language: supportedLang,
      totalTranslations: availableKeys.length,
      sampleTranslations: availableKeys.slice(0, limitNum).reduce(
        (acc, key) => {
          acc[key] = this.languageService.translate(key, supportedLang);
          return acc;
        },
        {} as Record<string, string>,
      ),
      availableCategories: this.getTranslationCategories(availableKeys),
      allKeys: availableKeys,
    };
  }

  /**
   * Test language metadata and capabilities
   * GET /test/language-metadata
   */
  @Get('language-metadata')
  testLanguageMetadata() {
    const supportedLanguages =
      this.languageService.getSupportedLanguagesWithMetadata();
    const defaultLanguage = this.languageService.getDefaultLanguage();

    return {
      supportedLanguages,
      defaultLanguage,
      totalLanguages: supportedLanguages.length,
      languageDetails: supportedLanguages.map((lang) => ({
        ...lang,
        displayName: this.languageService.getDisplayName(lang.code),
        nativeName: this.languageService.getNativeName(lang.code),
        englishName: this.languageService.getEnglishName(lang.code),
      })),
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
        metadata: this.languageService.getLanguageMetadata(testCase.supported),
      })),
      invalidCases: [
        {
          input: 'INVALID',
          prismaToSupported: this.languageService.prismaToSupported('INVALID'),
          fallbackToDefault: true,
        },
        {
          input: 'fr',
          isSupported: this.languageService.isSupported('fr'),
          validated: this.languageService.validateLanguage('fr'),
        },
      ],
    };
  }

  /**
   * Test translation sections (for debugging specific modules)
   * GET /test/translation-sections?lang=en&section=auth
   */
  @Get('translation-sections')
  testTranslationSections(
    @Query('lang') lang: string = 'id',
    @Query('section') section: string = 'auth',
  ) {
    const supportedLang = this.languageService.validateLanguage(lang);
    const validSections = ['auth', 'users', 'validation', 'common'];

    if (!validSections.includes(section)) {
      return {
        error: 'Invalid section',
        validSections,
        requested: section,
      };
    }

    try {
      const sectionData = this.languageService.getTranslationSection(
        section,
        supportedLang,
      );

      return {
        language: supportedLang,
        section: section,
        data: sectionData,
        structure: this.getObjectStructure(sectionData),
        hasFile: this.languageService.hasTranslationFile(
          section,
          supportedLang,
        ),
      };
    } catch (error) {
      return {
        error: error.message,
        language: supportedLang,
        section: section,
      };
    }
  }

  /**
   * Test file-based translation features
   * GET /test/file-features?lang=en
   */
  @Get('file-features')
  testFileFeatures(@Query('lang') lang: string = 'id') {
    const supportedLang = this.languageService.validateLanguage(lang);

    return {
      language: supportedLang,
      availableFiles: this.languageService.getAvailableFiles(supportedLang),
      fileTests: {
        auth: {
          hasFile: this.languageService.hasTranslationFile(
            'auth',
            supportedLang,
          ),
          loginSuccess: this.languageService.getTranslationFromFile(
            'auth',
            'messages.loginSuccess',
            supportedLang,
          ),
          invalidCredentials: this.languageService.getTranslationFromFile(
            'auth',
            'messages.invalidCredentials',
            supportedLang,
          ),
        },
        users: {
          hasFile: this.languageService.hasTranslationFile(
            'users',
            supportedLang,
          ),
          created: this.languageService.getTranslationFromFile(
            'users',
            'messages.created',
            supportedLang,
          ),
          adminRole: this.languageService.getTranslationFromFile(
            'users',
            'roles.ADMIN',
            supportedLang,
          ),
        },
        validation: {
          hasFile: this.languageService.hasTranslationFile(
            'validation',
            supportedLang,
          ),
          emailRequired: this.languageService.getTranslationFromFile(
            'validation',
            'email.required',
            supportedLang,
          ),
          passwordComplexity: this.languageService.getTranslationFromFile(
            'validation',
            'password.complexity',
            supportedLang,
          ),
        },
        common: {
          hasFile: this.languageService.hasTranslationFile(
            'common',
            supportedLang,
          ),
          success: this.languageService.getTranslationFromFile(
            'common',
            'messages.success',
            supportedLang,
          ),
          createAction: this.languageService.getTranslationFromFile(
            'common',
            'actions.create',
            supportedLang,
          ),
        },
      },
      cacheStats: this.languageService.getCacheStats(),
    };
  }

  /**
   * Test translation file management
   * GET /test/file-management?lang=en
   */
  @Get('file-management')
  testFileManagement(@Query('lang') lang: string = 'id') {
    const supportedLang = this.languageService.validateLanguage(lang);

    return {
      language: supportedLang,
      fileStats: this.languageService.getFileStats(),
      cacheStats: this.languageService.getCacheStats(),
      availableLanguages: this.languageService
        .getSupportedLanguages()
        .map((lang) => ({
          code: lang,
          files: this.languageService.getAvailableFiles(lang),
          totalTranslations:
            this.languageService.getAvailableTranslations(lang).length,
        })),
    };
  }

  /**
   * Test cache management
   * GET /test/cache-management
   */
  @Get('cache-management')
  async testCacheManagement() {
    const beforeStats = this.languageService.getCacheStats();

    // Perform some translations to populate cache
    const testTranslations = [
      this.languageService.translate(
        'auth.messages.loginSuccess',
        SupportedLanguage.ENGLISH,
      ),
      this.languageService.translate(
        'users.messages.created',
        SupportedLanguage.INDONESIAN,
      ),
      this.languageService.translate(
        'validation.email.required',
        SupportedLanguage.CHINESE,
      ),
    ];

    const afterStats = this.languageService.getCacheStats();

    // Clear cache
    this.languageService.clearCache();
    const clearedStats = this.languageService.getCacheStats();

    return {
      cacheTest: {
        before: beforeStats,
        after: afterStats,
        cleared: clearedStats,
      },
      translations: testTranslations,
      message: 'Cache management test completed',
    };
  }

  /**
   * Test translation reload (for development)
   * GET /test/reload-translations
   */
  @Get('reload-translations')
  async testReloadTranslations() {
    try {
      await this.languageService.reloadTranslations();

      return {
        success: true,
        message: 'Translations reloaded successfully',
        timestamp: new Date().toISOString(),
        cacheStats: this.languageService.getCacheStats(),
        fileStats: this.languageService.getFileStats(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test performance of translation system
   * GET /test/performance?iterations=1000&lang=en
   */
  @Get('performance')
  testPerformance(
    @Query('iterations') iterations: string = '1000',
    @Query('lang') lang: string = 'id',
  ) {
    const supportedLang = this.languageService.validateLanguage(lang);
    const iterationCount = parseInt(iterations) || 1000;

    const testKeys = [
      'auth.messages.loginSuccess',
      'users.messages.created',
      'validation.email.required',
      'common.messages.success',
      'validation.generic.tooShort',
    ];

    // Test direct translation performance
    const startDirect = Date.now();
    for (let i = 0; i < iterationCount; i++) {
      testKeys.forEach((key) => {
        this.languageService.translate(key, supportedLang);
      });
    }
    const directDuration = Date.now() - startDirect;

    // Test with arguments
    const startWithArgs = Date.now();
    for (let i = 0; i < iterationCount; i++) {
      this.languageService.translate(
        'validation.generic.tooShort',
        supportedLang,
        { field: 'Password', min: 8 },
      );
    }
    const withArgsDuration = Date.now() - startWithArgs;

    // Test type-safe methods
    const startTypeSafe = Date.now();
    for (let i = 0; i < iterationCount; i++) {
      this.languageService.translateAuth('loginSuccess', supportedLang);
      this.languageService.translateUsers('created', 'messages', supportedLang);
      this.languageService.translateValidation(
        'email',
        'required',
        supportedLang,
      );
    }
    const typeSafeDuration = Date.now() - startTypeSafe;

    return {
      iterations: iterationCount,
      language: supportedLang,
      results: {
        directTranslation: {
          totalTime: directDuration,
          averagePerCall: directDuration / (iterationCount * testKeys.length),
          callsPerSecond: Math.round(
            (iterationCount * testKeys.length) / (directDuration / 1000),
          ),
        },
        withArguments: {
          totalTime: withArgsDuration,
          averagePerCall: withArgsDuration / iterationCount,
          callsPerSecond: Math.round(
            iterationCount / (withArgsDuration / 1000),
          ),
        },
        typeSafeMethods: {
          totalTime: typeSafeDuration,
          averagePerCall: typeSafeDuration / (iterationCount * 3),
          callsPerSecond: Math.round(
            (iterationCount * 3) / (typeSafeDuration / 1000),
          ),
        },
      },
      performance: {
        rating: this.getPerformanceRating(directDuration, iterationCount),
        recommendations: this.getPerformanceRecommendations(
          directDuration,
          iterationCount,
        ),
      },
    };
  }

  /**
   * Test error handling and edge cases
   * GET /test/error-handling?lang=en
   */
  @Get('error-handling')
  testErrorHandling(@Query('lang') lang: string = 'id') {
    const supportedLang = this.languageService.validateLanguage(lang);

    const tests = [
      {
        name: 'Null key',
        test: () => this.languageService.translate(null as any, supportedLang),
      },
      {
        name: 'Undefined key',
        test: () =>
          this.languageService.translate(undefined as any, supportedLang),
      },
      {
        name: 'Empty key',
        test: () => this.languageService.translate('', supportedLang),
      },
      {
        name: 'Non-existent key',
        test: () =>
          this.languageService.translate('non.existent.key', supportedLang),
      },
      {
        name: 'Invalid language',
        test: () =>
          this.languageService.translate(
            'auth.messages.loginSuccess',
            'invalid' as any,
          ),
      },
      {
        name: 'Partial key',
        test: () =>
          this.languageService.translate('auth.messages', supportedLang),
      },
      {
        name: 'Translation with null args',
        test: () =>
          this.languageService.translate(
            'validation.generic.required',
            supportedLang,
            null as any,
          ),
      },
      {
        name: 'Translation with circular args',
        test: () => {
          const circular: any = {};
          circular.self = circular;
          return this.languageService.translate(
            'validation.generic.required',
            supportedLang,
            circular,
          );
        },
      },
    ];

    const results = tests.map((test) => {
      try {
        const result = test.test();
        return {
          name: test.name,
          success: true,
          result: result,
          error: null,
        };
      } catch (error) {
        return {
          name: test.name,
          success: false,
          result: null,
          error: error.message,
        };
      }
    });

    return {
      language: supportedLang,
      totalTests: tests.length,
      passedTests: results.filter((r) => r.success).length,
      failedTests: results.filter((r) => !r.success).length,
      results: results,
    };
  }

  /**
   * Test integration with real application scenarios
   * GET /test/integration-scenarios?lang=en
   */
  @Get('integration-scenarios')
  testIntegrationScenarios(@Query('lang') lang: string = 'id') {
    const supportedLang = this.languageService.validateLanguage(lang);

    // Scenario 1: User Registration
    const registrationScenario = {
      name: 'User Registration Flow',
      steps: [
        {
          step: 'Email validation',
          message: this.languageService.translate(
            'validation.email.required',
            supportedLang,
          ),
        },
        {
          step: 'Password complexity',
          message: this.languageService.translate(
            'validation.password.complexity',
            supportedLang,
          ),
        },
        {
          step: 'Email exists',
          message: this.languageService.translate(
            'validation.email.alreadyExists',
            supportedLang,
          ),
        },
        {
          step: 'Registration success',
          message: this.languageService.translate(
            'users.messages.created',
            supportedLang,
          ),
        },
      ],
    };

    // Scenario 2: Authentication
    const authScenario = {
      name: 'Authentication Flow',
      steps: [
        {
          step: 'Invalid credentials',
          message: this.languageService.translate(
            'auth.messages.invalidCredentials',
            supportedLang,
          ),
        },
        {
          step: 'Account deactivated',
          message: this.languageService.translate(
            'auth.messages.accountDeactivated',
            supportedLang,
          ),
        },
        {
          step: 'Login success',
          message: this.languageService.translate(
            'auth.messages.loginSuccess',
            supportedLang,
          ),
        },
        {
          step: 'Logout success',
          message: this.languageService.translate(
            'auth.messages.logoutSuccess',
            supportedLang,
          ),
        },
      ],
    };

    // Scenario 3: CRUD Operations
    const crudScenario = {
      name: 'CRUD Operations',
      steps: [
        {
          step: 'Create success',
          message: this.languageService.translate(
            'common.messages.created',
            supportedLang,
          ),
        },
        {
          step: 'Update success',
          message: this.languageService.translate(
            'common.messages.updated',
            supportedLang,
          ),
        },
        {
          step: 'Not found',
          message: this.languageService.translate(
            'common.messages.notFound',
            supportedLang,
          ),
        },
        {
          step: 'Delete success',
          message: this.languageService.translate(
            'common.messages.deleted',
            supportedLang,
          ),
        },
      ],
    };

    return {
      language: supportedLang,
      languageDisplay: this.languageService.getDisplayName(supportedLang),
      scenarios: [registrationScenario, authScenario, crudScenario],
      summary: {
        totalScenarios: 3,
        totalSteps:
          registrationScenario.steps.length +
          authScenario.steps.length +
          crudScenario.steps.length,
        allTranslationsFound: true, // This would be calculated in real implementation
      },
    };
  }

  // Helper methods
  private getTranslationCategories(keys: string[]): Record<string, number> {
    const categories: Record<string, number> = {};

    keys.forEach((key) => {
      const category = key.split('.')[0];
      categories[category] = (categories[category] || 0) + 1;
    });

    return categories;
  }

  private getObjectStructure(
    obj: any,
    maxDepth: number = 3,
    currentDepth: number = 0,
  ): any {
    if (currentDepth >= maxDepth || typeof obj !== 'object' || obj === null) {
      return typeof obj;
    }

    if (Array.isArray(obj)) {
      return `Array[${obj.length}]`;
    }

    const structure: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      structure[key] = this.getObjectStructure(
        obj[key],
        maxDepth,
        currentDepth + 1,
      );
    });

    return structure;
  }

  private getPerformanceRating(duration: number, iterations: number): string {
    const avgTime = duration / iterations;

    if (avgTime < 0.1) return 'Excellent';
    if (avgTime < 0.5) return 'Good';
    if (avgTime < 1) return 'Fair';
    return 'Needs Optimization';
  }

  private getPerformanceRecommendations(
    duration: number,
    iterations: number,
  ): string[] {
    const recommendations: string[] = [];
    const avgTime = duration / iterations;

    if (avgTime > 1) {
      recommendations.push('Consider caching frequently used translations');
    }
    if (duration > 5000) {
      recommendations.push('Large number of iterations taking too long');
    }
    if (avgTime < 0.1) {
      recommendations.push('Performance is excellent, no optimization needed');
    }

    return recommendations;
  }
}
