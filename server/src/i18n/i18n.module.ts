// src/i18n/i18n.module.ts
import { Global, Module } from '@nestjs/common';

import { TranslationLoaderService } from './services/translation-loader.service';
import { TranslationCacheService } from './services/translation-cache.service';
import { LanguageDetectorService } from './services/language-detector.service';
import { TranslationValidatorService } from './services/translation-validator.service';
import { LanguageService } from './services/language.service';
import { LanguageGuard } from './guards/language.guard';

@Global()
@Module({
  providers: [
    TranslationLoaderService,
    TranslationCacheService,
    LanguageDetectorService,
    TranslationValidatorService,
    LanguageService,
    LanguageGuard,
  ],
  exports: [
    TranslationLoaderService,
    TranslationCacheService,
    LanguageDetectorService,
    TranslationValidatorService,
    LanguageService,
    LanguageGuard,
  ],
})
export class AppI18nModule {}
