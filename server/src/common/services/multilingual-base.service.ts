// src/common/services/multilingual-base.service.ts - FIXED TYPESCRIPT TYPES
import { Injectable } from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../../i18n/constants/languages';

/**
 * Abstract base service yang menyediakan fungsionalitas multilingual
 * untuk semua services yang membutuhkan dukungan multi-bahasa
 */
@Injectable()
export abstract class MultilingualBaseService {
  constructor(
    protected readonly prisma: EnhancedDatabaseService,
    protected readonly languageService: LanguageService,
  ) {}

  /**
   * Convert SupportedLanguage to Prisma format
   * This method replaces the missing languageService.supportedToPrisma()
   */
  protected supportedToPrisma(lang: SupportedLanguage): string {
    const languageMapping = {
      EN: 'ENGLISH',
      ID: 'INDONESIAN',
    };

    return languageMapping[lang] || languageMapping['EN'];
  }

  /**
   * Convert Prisma Language to SupportedLanguage
   */
  protected prismaToSupported(prismaLang: string): SupportedLanguage {
    const reverseMapping = {
      ENGLISH: 'EN' as SupportedLanguage,
      INDONESIAN: 'ID' as SupportedLanguage,
    };

    return reverseMapping[prismaLang] || 'EN';
  }

  /**
   * Mencari translation dengan fallback ke bahasa default
   */
  protected async findTranslationWithFallback<T>(
    findTranslation: (language: string) => Promise<T | null>,
    requestedLanguage: SupportedLanguage,
  ): Promise<T | null> {
    // Convert supported language to Prisma format
    const prismaLanguage = this.supportedToPrisma(requestedLanguage);

    // Coba cari di bahasa yang diminta dulu
    const requestedTranslation = await findTranslation(prismaLanguage);
    if (requestedTranslation) {
      return requestedTranslation;
    }

    // Jika tidak ketemu, coba bahasa default
    const defaultLanguage = getDefaultLanguage();
    if (defaultLanguage !== requestedLanguage) {
      const defaultPrismaLanguage = this.supportedToPrisma(defaultLanguage);
      const fallbackTranslation = await findTranslation(defaultPrismaLanguage);
      if (fallbackTranslation) {
        return fallbackTranslation;
      }
    }

    return null;
  }

  /**
   * Validate language and convert to Prisma format
   */
  protected validateAndConvertLanguage(lang: string): string {
    const validatedLang = this.languageService.validateLanguage(lang);
    return this.supportedToPrisma(validatedLang);
  }

  /**
   * Create translations for all supported languages
   */
  protected async createTranslationsForAllLanguages<T, R = any>(
    createTranslation: (language: string, data: T) => Promise<R>,
    translationData: Record<SupportedLanguage, T>,
  ): Promise<R[]> {
    const results: R[] = [];

    for (const [supportedLang, data] of Object.entries(translationData)) {
      const prismaLang = this.supportedToPrisma(
        supportedLang as SupportedLanguage,
      );
      try {
        const result = await createTranslation(prismaLang, data);
        results.push(result);
      } catch (error) {
        console.error(
          `Failed to create translation for ${supportedLang}:`,
          error,
        );
      }
    }

    return results;
  }

  /**
   * Update translation with fallback
   */
  protected async updateTranslationWithFallback<T, R = any>(
    updateTranslation: (language: string, data: T) => Promise<R>,
    language: SupportedLanguage,
    data: T,
  ): Promise<R> {
    const prismaLanguage = this.supportedToPrisma(language);

    try {
      return await updateTranslation(prismaLanguage, data);
    } catch (error) {
      // If update fails, try with default language
      const defaultLanguage = getDefaultLanguage();
      if (defaultLanguage !== language) {
        const defaultPrismaLanguage = this.supportedToPrisma(defaultLanguage);
        return await updateTranslation(defaultPrismaLanguage, data);
      }
      throw error;
    }
  }

  /**
   * Get all supported languages in Prisma format
   */
  protected getAllPrismaLanguages(): string[] {
    return ['ENGLISH', 'INDONESIAN'];
  }

  /**
   * Check if translation exists for language
   */
  protected async hasTranslation(
    checkTranslation: (language: string) => Promise<boolean>,
    language: SupportedLanguage,
  ): Promise<boolean> {
    const prismaLanguage = this.supportedToPrisma(language);

    try {
      return await checkTranslation(prismaLanguage);
    } catch {
      return false;
    }
  }

  /**
   * Get translation summary for all languages
   */
  protected async getTranslationSummary<T>(
    getTranslation: (language: string) => Promise<T | null>,
  ): Promise<Record<SupportedLanguage, T | null>> {
    const summary: Record<SupportedLanguage, T | null> = {} as Record<
      SupportedLanguage,
      T | null
    >;

    for (const lang of ['EN', 'ID'] as SupportedLanguage[]) {
      const prismaLang = this.supportedToPrisma(lang);
      try {
        summary[lang] = await getTranslation(prismaLang);
      } catch (error) {
        console.error(`Failed to get translation for ${lang}:`, error);
        summary[lang] = null;
      }
    }

    return summary;
  }

  /**
   * Delete translations for specific languages
   */
  protected async deleteTranslations(
    deleteTranslation: (language: string) => Promise<void>,
    languages?: SupportedLanguage[],
  ): Promise<void> {
    const languagesToDelete =
      languages || (['EN', 'ID'] as SupportedLanguage[]);

    for (const lang of languagesToDelete) {
      const prismaLang = this.supportedToPrisma(lang);
      try {
        await deleteTranslation(prismaLang);
      } catch (error) {
        console.error(`Failed to delete translation for ${lang}:`, error);
      }
    }
  }

  /**
   * Get available translations
   */
  protected async getAvailableTranslations<T>(
    getTranslation: (language: string) => Promise<T | null>,
  ): Promise<Array<{ language: SupportedLanguage; data: T }>> {
    const available: Array<{ language: SupportedLanguage; data: T }> = [];

    for (const lang of ['EN', 'ID'] as SupportedLanguage[]) {
      const prismaLang = this.supportedToPrisma(lang);
      try {
        const translation = await getTranslation(prismaLang);
        if (translation) {
          available.push({ language: lang, data: translation });
        }
      } catch (error) {
        console.error(`Failed to get translation for ${lang}:`, error);
      }
    }

    return available;
  }

  /**
   * Ensure translation exists with fallback creation
   */
  protected async ensureTranslationExists<T>(
    getTranslation: (language: string) => Promise<T | null>,
    createTranslation: (language: string, data: T) => Promise<T>,
    language: SupportedLanguage,
    fallbackData: T,
  ): Promise<T> {
    const prismaLanguage = this.supportedToPrisma(language);

    // Try to get existing translation
    let translation = await getTranslation(prismaLanguage);

    if (!translation) {
      // Create translation with fallback data
      translation = await createTranslation(prismaLanguage, fallbackData);
    }

    return translation;
  }
}
