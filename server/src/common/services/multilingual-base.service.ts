// src/common/services/multilingual-base.service.ts - Fixed Implementation
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LanguageService } from '../../i18n/services/language.service';
import { SupportedLanguage } from '../../i18n/constants/languages';

/**
 * Abstract base service yang menyediakan fungsionalitas multilingual
 * untuk semua services yang membutuhkan dukungan multi-bahasa
 */
@Injectable()
export abstract class MultilingualBaseService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly languageService: LanguageService,
  ) {}

  /**
   * Mencari translation dengan fallback ke bahasa default
   * Jika tidak ditemukan di bahasa yang diminta, akan coba bahasa default
   *
   * @param findTranslation - Function untuk mencari translation
   * @param requestedLanguage - Bahasa yang diminta user
   * @returns Translation yang ditemukan atau null
   */
  protected async findTranslationWithFallback<T>(
    findTranslation: (language: string) => Promise<T | null>,
    requestedLanguage: SupportedLanguage,
  ): Promise<T | null> {
    // Coba cari di bahasa yang diminta dulu
    const requestedTranslation = await findTranslation(requestedLanguage);
    if (requestedTranslation) {
      return requestedTranslation;
    }

    // Jika tidak ketemu, coba bahasa default - FIXED: use correct method name
    const defaultLanguage = this.languageService.getDefaultLanguage();
    if (defaultLanguage !== requestedLanguage) {
      const fallbackTranslation = await findTranslation(defaultLanguage);
      if (fallbackTranslation) {
        return fallbackTranslation;
      }
    }

    // Tidak ketemu di mana-mana
    return null;
  }

  /**
   * Format entity dengan translation yang sesuai
   * Menambahkan field 'translation' ke entity jika ada
   *
   * @param entity - Entity utama
   * @param translations - Array semua translation yang tersedia
   * @param requestedLanguage - Bahasa yang diminta
   * @returns Entity dengan translation yang di-attach
   */
  protected formatEntityWithTranslation<
    TEntity,
    TTranslation extends { language: string },
  >(
    entity: TEntity,
    translations: TTranslation[],
    requestedLanguage: SupportedLanguage,
  ): TEntity & { translation?: TTranslation } {
    // Convert SupportedLanguage to Prisma Language format for comparison
    const requestedPrismaLang =
      this.languageService.supportedToPrisma(requestedLanguage);

    // Cari translation untuk bahasa yang diminta
    let selectedTranslation = translations.find(
      (translation) => translation.language === requestedPrismaLang,
    );

    // Jika tidak ada, coba bahasa default
    if (!selectedTranslation) {
      const defaultLanguage = this.languageService.getDefaultLanguage();
      const defaultPrismaLang =
        this.languageService.supportedToPrisma(defaultLanguage);
      selectedTranslation = translations.find(
        (translation) => translation.language === defaultPrismaLang,
      );
    }

    // Return entity dengan translation (bisa undefined jika tidak ada)
    return {
      ...entity,
      translation: selectedTranslation,
    };
  }

  /**
   * Format array entities dengan translations masing-masing
   *
   * @param entities - Array entities
   * @param requestedLanguage - Bahasa yang diminta
   * @returns Array entities dengan translations
   */
  protected formatEntitiesWithTranslations<
    TEntity extends { translations?: TTranslation[] },
    TTranslation extends { language: string },
  >(
    entities: TEntity[],
    requestedLanguage: SupportedLanguage,
  ): (TEntity & { translation?: TTranslation })[] {
    return entities.map((entity) =>
      this.formatEntityWithTranslation(
        entity,
        entity.translations || [],
        requestedLanguage,
      ),
    );
  }

  /**
   * Dapatkan pesan error/success dalam bahasa yang sesuai
   *
   * @param messageKey - Key untuk pesan di file translation
   * @param language - Bahasa yang diinginkan
   * @param args - Arguments untuk replace placeholder
   * @returns Pesan yang sudah ditranslate
   */
  protected getLocalizedMessage(
    messageKey: string,
    language: SupportedLanguage,
    args?: Record<string, any>,
  ): string {
    return this.languageService.translate(messageKey, language, args);
  }

  /**
   * Validasi apakah entity memiliki translation dalam bahasa tertentu
   *
   * @param translations - Array translations
   * @param language - Bahasa yang dicek
   * @returns true jika ada translation untuk bahasa tersebut
   */
  protected hasTranslationForLanguage<T extends { language: string }>(
    translations: T[],
    language: SupportedLanguage,
  ): boolean {
    return translations.some(
      (translation) => translation.language === language,
    );
  }

  /**
   * Dapatkan semua bahasa yang tersedia untuk entity tertentu
   *
   * @param translations - Array translations
   * @returns Array bahasa yang tersedia
   */
  protected getAvailableLanguages<T extends { language: string }>(
    translations: T[],
  ): string[] {
    return [
      ...new Set(translations.map((translation) => translation.language)),
    ];
  }

  /**
   * Format response dengan metadata bahasa
   * Berguna untuk API responses yang ingin menampilkan info bahasa
   */
  protected formatResponseWithLanguageMetadata<T>(
    data: T,
    currentLanguage: SupportedLanguage,
    availableLanguages?: string[],
  ): T & {
    _language: {
      current: SupportedLanguage;
      available?: string[];
      metadata: {
        code: SupportedLanguage;
        name: string;
        nativeName: string;
        flag: string;
      };
    };
  } {
    return {
      ...data,
      _language: {
        current: currentLanguage,
        available: availableLanguages,
        metadata: {
          code: currentLanguage,
          name: this.languageService.getEnglishName(currentLanguage),
          nativeName: this.languageService.getNativeName(currentLanguage),
          flag: this.languageService.getLanguageFlag(currentLanguage),
        },
      },
    };
  }

  /**
   * Create standard pagination metadata
   */
  protected createPaginationMeta(
    page: number,
    limit: number,
    total: number,
  ): {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Validate pagination parameters
   */
  protected validatePaginationParams(
    page: number,
    limit: number,
  ): {
    page: number;
    limit: number;
  } {
    const validatedPage = Math.max(1, page || 1);
    const validatedLimit = Math.min(Math.max(1, limit || 10), 100); // Max 100 items per page

    return {
      page: validatedPage,
      limit: validatedLimit,
    };
  }
}
