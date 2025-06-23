// src/i18n/services/language.service.ts - FIXED DETECTION SOURCES
import { Injectable, Logger } from '@nestjs/common';
import {
  SupportedLanguage,
  getDefaultLanguage,
  SUPPORTED_LANGUAGES,
  LanguageMetadata,
  LANGUAGE_METADATA,
} from '../constants/languages';

// ✅ FIXED: Added missing userPreference property
export interface LanguageDetectionSources {
  query?: string;
  header?: string;
  acceptLanguage?: string;
  userPreference?: SupportedLanguage; // ✅ ADDED: Missing property
}

@Injectable()
export class LanguageService {
  private readonly logger = new Logger(LanguageService.name);

  constructor() {
    this.logger.log('✅ LanguageService initialized');
  }

  /**
   * Get the default language
   */
  getDefaultLanguage(): SupportedLanguage {
    return getDefaultLanguage();
  }

  /**
   * Validate if a language code is supported
   */
  validateLanguage(lang: string): SupportedLanguage {
    const upperLang = lang?.toUpperCase();

    if (SUPPORTED_LANGUAGES.includes(upperLang as SupportedLanguage)) {
      return upperLang as SupportedLanguage;
    }

    return getDefaultLanguage();
  }

  /**
   * Convert SupportedLanguage to Prisma Language enum
   */
  supportedToPrisma(lang: SupportedLanguage): string {
    const languageMapping = {
      EN: 'EN',
      ID: 'ID',
    };

    return languageMapping[lang] || languageMapping['EN'];
  }

  /**
   * Convert Prisma Language enum to SupportedLanguage
   */
  prismaToSupported(prismaLang: string): SupportedLanguage {
    const reverseMapping = {
      EN: 'EN' as SupportedLanguage,
      ID: 'ID' as SupportedLanguage,
    };

    return reverseMapping[prismaLang] || 'EN';
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return [...SUPPORTED_LANGUAGES];
  }

  /**
   * Get all Prisma language values
   */
  getAllPrismaLanguages(): string[] {
    return SUPPORTED_LANGUAGES.map((lang) => this.supportedToPrisma(lang));
  }

  /**
   * Get language metadata
   */
  getLanguageMetadata(lang: SupportedLanguage): LanguageMetadata {
    return LANGUAGE_METADATA[lang] || LANGUAGE_METADATA[getDefaultLanguage()];
  }

  /**
   * Get display name for a language
   */
  getDisplayName(lang: SupportedLanguage): string {
    const metadata = this.getLanguageMetadata(lang);
    return metadata.displayName;
  }

  /**
   * Check if a language is RTL
   */
  isRightToLeft(lang: SupportedLanguage): boolean {
    const metadata = this.getLanguageMetadata(lang);
    return metadata.direction === 'rtl';
  }

  /**
   * Translate a key to the specified language
   */
  translate(
    key: string,
    lang: SupportedLanguage,
    params?: Record<string, any>,
  ): string {
    try {
      // Validate language
      const validLang = this.validateLanguage(lang);

      // Simple implementation for now
      // In a real implementation, this would load from translation files
      let translation = this.getSimpleTranslation(key, validLang);

      if (!translation && validLang !== getDefaultLanguage()) {
        // Fallback to default language
        translation = this.getSimpleTranslation(key, getDefaultLanguage());
      }

      if (!translation) {
        this.logger.warn(`Translation not found: ${key} (${validLang})`);
        return key;
      }

      return this.interpolateParams(translation, params);
    } catch (error) {
      this.logger.error(`Translation error for key ${key}:`, error);
      return key;
    }
  }

  /**
   * Check if a translation exists
   */
  hasTranslation(key: string, lang: SupportedLanguage): boolean {
    try {
      const validLang = this.validateLanguage(lang);
      const translation = this.getSimpleTranslation(key, validLang);
      return !!translation;
    } catch {
      return false;
    }
  }

  /**
   * Detect language from various sources
   */
  detectLanguageFromSources(
    sources: LanguageDetectionSources,
  ): SupportedLanguage {
    // ✅ FIXED: Check userPreference first (if available)
    if (sources.userPreference) {
      return sources.userPreference;
    }

    // Check query parameter
    if (sources.query) {
      const validLang = this.validateLanguage(sources.query);
      if (validLang) return validLang;
    }

    // Check header
    if (sources.header) {
      const validLang = this.validateLanguage(sources.header);
      if (validLang) return validLang;
    }

    // Check Accept-Language header
    if (sources.acceptLanguage) {
      return this.detectFromAcceptLanguage(sources.acceptLanguage);
    }

    return getDefaultLanguage();
  }

  /**
   * Detect language from Accept-Language header
   */
  detectFromAcceptLanguage(acceptLanguage: string): SupportedLanguage {
    try {
      // Parse Accept-Language header (simplified)
      const languages = acceptLanguage
        .split(',')
        .map((lang) => lang.split(';')[0].trim().toUpperCase())
        .map((lang) => lang.substring(0, 2)); // Get first 2 characters

      for (const lang of languages) {
        const mappedLang = this.mapToSupportedLanguage(lang);
        if (mappedLang) {
          return mappedLang;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse Accept-Language header:', error);
    }

    return getDefaultLanguage();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: 0,
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.logger.log('Translation cache cleared');
  }

  /**
   * Get available locales
   */
  getAvailableLocales(): Array<{
    code: SupportedLanguage;
    name: string;
    nativeName: string;
  }> {
    return SUPPORTED_LANGUAGES.map((lang) => {
      const metadata = this.getLanguageMetadata(lang);
      return {
        code: lang,
        name: metadata.displayName,
        nativeName: metadata.nativeName,
      };
    });
  }

  /**
   * Validate and convert language for database operations
   */
  validateAndConvertToPrisma(lang: string): string {
    const validatedLang = this.validateLanguage(lang);
    return this.supportedToPrisma(validatedLang);
  }

  /**
   * Simple translation implementation
   */
  private getSimpleTranslation(
    key: string,
    lang: SupportedLanguage,
  ): string | null {
    // Simple hardcoded translations for common keys
    const translations = {
      EN: {
        'common.messages.success': 'Success',
        'common.messages.error': 'Error',
        'common.messages.notFound': 'Not Found',
        'common.messages.badRequest': 'Bad Request',
        'common.messages.internalError': 'Internal Server Error',
        'auth.messages.unauthorized': 'Unauthorized',
        'auth.messages.forbidden': 'Forbidden',
        'auth.messages.invalidCredentials': 'Invalid credentials',
        'auth.messages.loginFailed': 'Login failed',
        'auth.messages.invalidToken': 'Invalid token',
        'auth.messages.logoutSuccess': 'Logout successful',
        'auth.messages.logoutAllSuccess': 'Logout from all devices successful',
        'validation.password.mismatch': 'Password confirmation does not match',
        'validation.email.alreadyExists': 'Email already exists',
        'validation.messages.failed': 'Validation failed',
        'users.messages.created': 'User created successfully',
        'users.messages.updated': 'User updated successfully',
        'users.messages.deleted': 'User deleted successfully',
        'users.messages.notFound': 'User not found',
      },
      ID: {
        'common.messages.success': 'Berhasil',
        'common.messages.error': 'Kesalahan',
        'common.messages.notFound': 'Tidak Ditemukan',
        'common.messages.badRequest': 'Permintaan Tidak Valid',
        'common.messages.internalError': 'Kesalahan Server Internal',
        'auth.messages.unauthorized': 'Tidak Diizinkan',
        'auth.messages.forbidden': 'Dilarang',
        'auth.messages.invalidCredentials': 'Kredensial tidak valid',
        'auth.messages.loginFailed': 'Login gagal',
        'auth.messages.invalidToken': 'Token tidak valid',
        'auth.messages.logoutSuccess': 'Logout berhasil',
        'auth.messages.logoutAllSuccess':
          'Logout dari semua perangkat berhasil',
        'validation.password.mismatch': 'Konfirmasi password tidak cocok',
        'validation.email.alreadyExists': 'Email sudah ada',
        'validation.messages.failed': 'Validasi gagal',
        'users.messages.created': 'User berhasil dibuat',
        'users.messages.updated': 'User berhasil diperbarui',
        'users.messages.deleted': 'User berhasil dihapus',
        'users.messages.notFound': 'User tidak ditemukan',
      },
    };

    return translations[lang]?.[key] || null;
  }

  /**
   * Map language code to supported language
   */
  private mapToSupportedLanguage(langCode: string): SupportedLanguage | null {
    const mapping = {
      EN: 'EN' as SupportedLanguage,
      ID: 'ID' as SupportedLanguage,
      IN: 'ID' as SupportedLanguage, // Alternative for Indonesian
    };

    return mapping[langCode.toUpperCase()] || null;
  }

  /**
   * Interpolate parameters into translation string
   */
  private interpolateParams(
    translation: string,
    params?: Record<string, any>,
  ): string {
    if (!params || typeof translation !== 'string') {
      return translation;
    }

    return translation.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }
}
