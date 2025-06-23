// src/i18n/index.ts
// export { TranslationLoaderService } from './services/translation-loader.service';
// export { LanguageDetectorService } from './services/language-detector.service';
export { LanguageService } from './services/language.service';
export { LanguageGuard } from './guards/language.guard';
export { AppI18nModule } from './i18n.module';

// Constants and decorators
export * from './constants/languages';
export { CurrentLanguage } from './decorators/current-language.decorator';
