// src/i18n/i18n.module.ts - FIXED IMPORTS
import { Global, Module } from '@nestjs/common';

import { TranslationLoaderService } from './services/translation-loader.service';
import { TranslationCacheService } from './services/translation-cache.service'; // ✅ NOW EXISTS
import { LanguageDetectorService } from './services/language-detector.service'; // ✅ NOW EXISTS
import { TranslationValidatorService } from './services/translation-validator.service'; // ✅ NOW EXISTS
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
