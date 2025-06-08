// src/i18n/i18n.module.ts - EMERGENCY STANDALONE VERSION
import { Global, Module } from '@nestjs/common';
import { LanguageService } from './services/language.service';
import { LanguageGuard } from './guards/language.guard';

// Completely remove nestjs-i18n dependency for now
@Global()
@Module({
  providers: [LanguageService, LanguageGuard],
  exports: [LanguageService, LanguageGuard],
})
export class AppI18nModule {}
