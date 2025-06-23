// src/i18n/services/language.service.ts - UPDATED WITH CHINESE SUPPORT
import { Injectable, Logger } from '@nestjs/common';
import {
  SupportedLanguage,
  getDefaultLanguage,
  SUPPORTED_LANGUAGES,
  LanguageMetadata,
  LANGUAGE_METADATA,
} from '../constants/languages';

export interface LanguageDetectionSources {
  query?: string;
  header?: string;
  acceptLanguage?: string;
  userPreference?: SupportedLanguage;
}

@Injectable()
export class LanguageService {
  private readonly logger = new Logger(LanguageService.name);

  constructor() {
    this.logger.log('✅ LanguageService initialized with Chinese support');
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

    // ✅ UPDATED: Enhanced mapping with Chinese variants
    const langMapping: Record<string, SupportedLanguage> = {
      EN: 'EN',
      ENG: 'EN',
      ENGLISH: 'EN',
      ID: 'ID',
      IND: 'ID',
      INDONESIAN: 'ID',
      IN: 'ID',
      ZH: 'ZH',
      CHI: 'ZH',
      CHINESE: 'ZH',
      CN: 'ZH',
      'ZH-CN': 'ZH',
      'ZH-TW': 'ZH',
      'ZH-HANS': 'ZH',
      'ZH-HANT': 'ZH',
    };

    return langMapping[upperLang] || getDefaultLanguage();
  }

  /**
   * Convert SupportedLanguage to Prisma Language enum
   */
  supportedToPrisma(lang: SupportedLanguage): string {
    const languageMapping = {
      EN: 'EN',
      ID: 'ID',
      ZH: 'ZH', // ✅ ADDED Chinese mapping
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
      ZH: 'ZH' as SupportedLanguage, // ✅ ADDED Chinese mapping
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
      const validLang = this.validateLanguage(lang);
      let translation = this.getSimpleTranslation(key, validLang);

      if (!translation && validLang !== getDefaultLanguage()) {
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
    if (sources.userPreference) {
      return sources.userPreference;
    }

    if (sources.query) {
      const validLang = this.validateLanguage(sources.query);
      if (validLang) return validLang;
    }

    if (sources.header) {
      const validLang = this.validateLanguage(sources.header);
      if (validLang) return validLang;
    }

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
      const languages = acceptLanguage
        .split(',')
        .map((lang) => lang.split(';')[0].trim().toUpperCase())
        .map((lang) => lang.substring(0, 2));

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
   * ✅ UPDATED: Enhanced translation implementation with Chinese support
   */
  private getSimpleTranslation(
    key: string,
    lang: SupportedLanguage,
  ): string | null {
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
      // ✅ ADDED: Chinese translations
      ZH: {
        'common.messages.success': '成功',
        'common.messages.error': '发生错误',
        'common.messages.notFound': '未找到数据',
        'common.messages.badRequest': '无效请求',
        'common.messages.internalError': '内部服务器错误',
        'auth.messages.unauthorized': '未授权访问',
        'auth.messages.forbidden': '访问被拒绝',
        'auth.messages.invalidCredentials': '邮箱或密码无效',
        'auth.messages.loginFailed': '登录失败',
        'auth.messages.invalidToken': '无效或过期的令牌',
        'auth.messages.logoutSuccess': '登出成功',
        'auth.messages.logoutAllSuccess': '从所有设备登出成功',
        'validation.password.mismatch': '密码确认不匹配',
        'validation.email.alreadyExists': '邮箱已被注册',
        'validation.messages.failed': '验证失败',
        'users.messages.created': '用户创建成功',
        'users.messages.updated': '用户更新成功',
        'users.messages.deleted': '用户删除成功',
        'users.messages.notFound': '未找到用户',
      },
    };

    return translations[lang]?.[key] || null;
  }

  /**
   * ✅ UPDATED: Enhanced language mapping with Chinese variants
   */
  private mapToSupportedLanguage(langCode: string): SupportedLanguage | null {
    const mapping = {
      EN: 'EN' as SupportedLanguage,
      ID: 'ID' as SupportedLanguage,
      IN: 'ID' as SupportedLanguage,
      ZH: 'ZH' as SupportedLanguage,
      CN: 'ZH' as SupportedLanguage,
      CHI: 'ZH' as SupportedLanguage,
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
   * Validate and convert language for database operations
   */
  validateAndConvertToPrisma(lang: string): string {
    const validatedLang = this.validateLanguage(lang);
    return this.supportedToPrisma(validatedLang);
  }
}
