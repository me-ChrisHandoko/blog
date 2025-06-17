// src/i18n/services/language.service.ts - EMERGENCY STANDALONE VERSION
import { Injectable, Logger } from '@nestjs/common';
import {
  SupportedLanguage,
  LanguageMetadata,
  isValidLanguage,
  getDefaultLanguage,
} from '../constants/languages';

/**
 * Standalone Language Service - No external I18n dependencies
 * This is a temporary solution to get the app running
 */
@Injectable()
export class LanguageService {
  private readonly logger = new Logger(LanguageService.name);

  // Inline translations - all languages in one place
  private readonly translations: Record<
    SupportedLanguage,
    Record<string, string>
  > = {
    [SupportedLanguage.INDONESIAN]: {
      // Auth messages
      'auth.messages.invalidCredentials': 'Email atau password tidak valid',
      'auth.messages.accountDeactivated': 'Akun Anda telah dinonaktifkan',
      'auth.messages.loginSuccess': 'Login berhasil',
      'auth.messages.logoutSuccess': 'Logout berhasil',
      'auth.messages.tokenRefreshed': 'Token berhasil diperbarui',
      'auth.messages.invalidToken': 'Token tidak valid atau telah kedaluwarsa',
      // Users messages
      'users.messages.created': 'Pengguna berhasil dibuat',
      'users.messages.updated': 'Pengguna berhasil diperbarui',
      'users.messages.deleted': 'Pengguna berhasil dihapus',
      'users.messages.restored': 'Pengguna berhasil dipulihkan',
      'users.messages.notFound': 'Pengguna tidak ditemukan',
      'users.messages.emailExists': 'Email sudah terdaftar oleh pengguna lain',
      'users.messages.profileCreated': 'Profil berhasil dibuat',
      'users.messages.profileUpdated': 'Profil berhasil diperbarui',
      'users.messages.profileNotFound': 'Profil tidak ditemukan',
      'users.messages.profileExists': 'Profil sudah ada untuk pengguna ini',
      'users.messages.profileTranslationRequired':
        'Setidaknya satu terjemahan profil diperlukan',
      'users.messages.statsRetrieved': 'Statistik pengguna berhasil diambil',
      'users.messages.translationCreated': 'Terjemahan profil berhasil dibuat',
      'users.messages.translationUpdated':
        'Terjemahan profil berhasil diperbarui',
      'users.messages.translationNotFound':
        'Terjemahan tidak ditemukan untuk bahasa tersebut',

      // Common messages
      'common.messages.success': 'Berhasil',
      'common.messages.error': 'Terjadi kesalahan',
      'common.messages.notFound': 'Data tidak ditemukan',
      'common.messages.unauthorized': 'Akses tidak diizinkan',
      'common.messages.forbidden': 'Akses ditolak',
      'common.messages.badRequest': 'Permintaan tidak valid',
      'common.messages.internalError': 'Kesalahan server internal',
      'common.messages.created': 'Berhasil dibuat',
      'common.messages.updated': 'Berhasil diperbarui',
      'common.messages.deleted': 'Berhasil dihapus',
      'common.messages.restored': 'Berhasil dipulihkan',

      // Validation messages
      'validation.generic.required': 'Field {field} wajib diisi',
      'validation.generic.invalid': 'Format {field} tidak valid',
      'validation.generic.tooShort':
        '{field} terlalu pendek (minimal {min} karakter)',
      'validation.generic.tooLong':
        '{field} terlalu panjang (maksimal {max} karakter)',
      'validation.generic.notUnique': '{field} sudah digunakan',
      'validation.email.invalid': 'Format email tidak valid',
      'validation.email.required': 'Email wajib diisi',
      'validation.email.alreadyExists': 'Email sudah terdaftar',
      'validation.password.required': 'Password wajib diisi',
      'validation.password.complexity':
        'Password harus mengandung minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, angka dan simbol',
      'validation.password.minLength': 'Password minimal 8 karakter',
      'validation.password.pattern':
        'Password harus mengandung kombinasi huruf besar, huruf kecil, angka dan simbol',
      'validation.password.mismatch': 'Konfirmasi password tidak cocok',
      'validation.name.tooShort': 'Nama minimal 2 karakter',
      'validation.name.tooLong': 'Nama maksimal 50 karakter',
      'validation.name.required': 'Nama wajib diisi',
      'validation.phone.invalid':
        'Format nomor telepon tidak valid (contoh: +628123456789)',
      'validation.phone.required': 'Nomor telepon wajib diisi',
      'validation.language.unsupported':
        'Bahasa tidak didukung. Bahasa yang tersedia: {languages}',
      'validation.language.required': 'Bahasa wajib dipilih',
    },

    [SupportedLanguage.ENGLISH]: {
      // Auth messages
      'auth.messages.invalidCredentials': 'Invalid email or password',
      'auth.messages.accountDeactivated': 'Your account has been deactivated',
      'auth.messages.loginSuccess': 'Login successful',
      'auth.messages.logoutSuccess': 'Logout successful',
      'auth.messages.tokenRefreshed': 'Token refreshed successfully',
      'auth.messages.invalidToken': 'Invalid or expired token',
      // Users messages
      'users.messages.created': 'User successfully created',
      'users.messages.updated': 'User successfully updated',
      'users.messages.deleted': 'User successfully deleted',
      'users.messages.restored': 'User successfully restored',
      'users.messages.notFound': 'User not found',
      'users.messages.emailExists':
        'Email is already registered by another user',
      'users.messages.profileCreated': 'Profile successfully created',
      'users.messages.profileUpdated': 'Profile successfully updated',
      'users.messages.profileNotFound': 'Profile not found',
      'users.messages.profileExists': 'Profile already exists for this user',
      'users.messages.profileTranslationRequired':
        'At least one profile translation is required',
      'users.messages.statsRetrieved': 'User statistics successfully retrieved',
      'users.messages.translationCreated':
        'Profile translation successfully created',
      'users.messages.translationUpdated':
        'Profile translation successfully updated',
      'users.messages.translationNotFound':
        'Translation not found for that language',

      // Common messages
      'common.messages.success': 'Success',
      'common.messages.error': 'An error occurred',
      'common.messages.notFound': 'Data not found',
      'common.messages.unauthorized': 'Unauthorized access',
      'common.messages.forbidden': 'Access denied',
      'common.messages.badRequest': 'Invalid request',
      'common.messages.internalError': 'Internal server error',
      'common.messages.created': 'Successfully created',
      'common.messages.updated': 'Successfully updated',
      'common.messages.deleted': 'Successfully deleted',
      'common.messages.restored': 'Successfully restored',

      // Validation messages
      'validation.generic.required': '{field} is required',
      'validation.generic.invalid': 'Invalid {field} format',
      'validation.generic.tooShort':
        '{field} is too short (minimum {min} characters)',
      'validation.generic.tooLong':
        '{field} is too long (maximum {max} characters)',
      'validation.generic.notUnique': '{field} is already taken',
      'validation.email.invalid': 'Invalid email format',
      'validation.email.required': 'Email is required',
      'validation.email.alreadyExists': 'Email is already registered',
      'validation.password.required': 'Password is required',
      'validation.password.complexity':
        'Password must contain at least 8 characters with a combination of uppercase, lowercase, numbers, and symbols',
      'validation.password.minLength': 'Password must be at least 8 characters',
      'validation.password.pattern':
        'Password must contain uppercase, lowercase, numbers, and symbols',
      'validation.password.mismatch': 'Password confirmation does not match',
      'validation.name.tooShort': 'Name must be at least 2 characters',
      'validation.name.tooLong': 'Name must not exceed 50 characters',
      'validation.name.required': 'Name is required',
      'validation.phone.invalid':
        'Invalid phone number format (example: +628123456789)',
      'validation.phone.required': 'Phone number is required',
      'validation.language.unsupported':
        'Language not supported. Available languages: {languages}',
      'validation.language.required': 'Language must be selected',
    },

    [SupportedLanguage.CHINESE]: {
      // Auth messages
      'auth.messages.invalidCredentials': '邮箱或密码无效',
      'auth.messages.accountDeactivated': '您的账户已被停用',
      'auth.messages.loginSuccess': '登录成功',
      'auth.messages.logoutSuccess': '登出成功',
      'auth.messages.tokenRefreshed': '令牌刷新成功',
      'auth.messages.invalidToken': '无效或过期的令牌',
      // Users messages
      'users.messages.created': '用户创建成功',
      'users.messages.updated': '用户更新成功',
      'users.messages.deleted': '用户删除成功',
      'users.messages.restored': '用户恢复成功',
      'users.messages.notFound': '未找到用户',
      'users.messages.emailExists': '邮箱已被其他用户注册',
      'users.messages.profileCreated': '配置文件创建成功',
      'users.messages.profileUpdated': '配置文件更新成功',
      'users.messages.profileNotFound': '未找到配置文件',
      'users.messages.profileExists': '该用户已存在配置文件',
      'users.messages.profileTranslationRequired': '至少需要一个配置文件翻译',
      'users.messages.statsRetrieved': '用户统计信息获取成功',
      'users.messages.translationCreated': '配置文件翻译创建成功',
      'users.messages.translationUpdated': '配置文件翻译更新成功',
      'users.messages.translationNotFound': '未找到该语言的翻译',

      // Common messages
      'common.messages.success': '成功',
      'common.messages.error': '发生错误',
      'common.messages.notFound': '未找到数据',
      'common.messages.unauthorized': '未授权访问',
      'common.messages.forbidden': '访问被拒绝',
      'common.messages.badRequest': '无效请求',
      'common.messages.internalError': '内部服务器错误',
      'common.messages.created': '创建成功',
      'common.messages.updated': '更新成功',
      'common.messages.deleted': '删除成功',
      'common.messages.restored': '恢复成功',

      // Validation messages
      'validation.generic.required': '{field} 是必填项',
      'validation.generic.invalid': '无效的 {field} 格式',
      'validation.generic.tooShort': '{field} 太短（最少 {min} 个字符）',
      'validation.generic.tooLong': '{field} 太长（最多 {max} 个字符）',
      'validation.generic.notUnique': '{field} 已被使用',
      'validation.email.invalid': '无效的邮箱格式',
      'validation.email.required': '邮箱是必填项',
      'validation.email.alreadyExists': '邮箱已被注册',
      'validation.password.required': '密码是必填项',
      'validation.password.complexity':
        '密码必须包含至少8个字符，包括大写字母、小写字母、数字和符号',
      'validation.password.minLength': '密码必须至少8个字符',
      'validation.password.pattern':
        '密码必须包含大写字母、小写字母、数字和符号',
      'validation.password.mismatch': '密码确认不匹配',
      'validation.name.tooShort': '姓名至少需要2个字符',
      'validation.name.tooLong': '姓名不能超过50个字符',
      'validation.name.required': '姓名是必填项',
      'validation.phone.invalid': '无效的电话号码格式（例如：+628123456789）',
      'validation.phone.required': '电话号码是必填项',
      'validation.language.unsupported': '不支持该语言。可用语言：{languages}',
      'validation.language.required': '必须选择语言',
    },
  };

  constructor() {
    this.logger.log('✅ Standalone Language Service initialized');
  }

  getDefaultLanguage(): SupportedLanguage {
    return getDefaultLanguage();
  }

  detectLanguageFromSources(sources: {
    query?: string;
    header?: string;
    acceptLanguage?: string;
    userPreference?: string;
  }): SupportedLanguage {
    const { query, header, acceptLanguage, userPreference } = sources;

    // Priority 1: Query parameter (?lang=en)
    if (query && isValidLanguage(query)) {
      this.logger.debug(`Language detected from query: ${query}`);
      return query;
    }

    // Priority 2: Custom header (X-Language: en)
    if (header && isValidLanguage(header)) {
      this.logger.debug(`Language detected from header: ${header}`);
      return header;
    }

    // Priority 3: User's saved preference
    if (userPreference && isValidLanguage(userPreference)) {
      this.logger.debug(
        `Language detected from user preference: ${userPreference}`,
      );
      return userPreference;
    }

    // Priority 4: Accept-Language header dari browser
    if (acceptLanguage) {
      const detectedLang = this.parseAcceptLanguageHeader(acceptLanguage);
      if (detectedLang) {
        this.logger.debug(
          `Language detected from Accept-Language: ${detectedLang}`,
        );
        return detectedLang;
      }
    }

    // Fallback ke bahasa default
    const defaultLang = this.getDefaultLanguage();
    this.logger.debug(`Using default language: ${defaultLang}`);
    return defaultLang;
  }

  private parseAcceptLanguageHeader(
    acceptLanguage: string,
  ): SupportedLanguage | null {
    try {
      const languages = acceptLanguage
        .split(',')
        .map((lang) => {
          const [code, priority] = lang.trim().split(';');
          const langCode = code.split('-')[0].toLowerCase(); // en-US -> en
          const q = priority ? parseFloat(priority.replace('q=', '')) : 1;
          return { code: langCode, priority: q };
        })
        .sort((a, b) => b.priority - a.priority); // Sort by priority

      for (const lang of languages) {
        if (isValidLanguage(lang.code)) {
          return lang.code;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Error parsing Accept-Language header: ${error.message}`,
      );
    }

    return null;
  }

  /**
   * Main translation method - fully standalone
   */
  translate(
    key: string,
    lang: SupportedLanguage,
    args?: Record<string, any>,
  ): string {
    // Get translation from inline data
    const translation = this.translations[lang]?.[key];

    if (translation) {
      return this.interpolateArgs(translation, args);
    }

    // Try default language as fallback
    if (lang !== this.getDefaultLanguage()) {
      const defaultTranslation =
        this.translations[this.getDefaultLanguage()]?.[key];
      if (defaultTranslation) {
        this.logger.debug(`Using default language translation for key: ${key}`);
        return this.interpolateArgs(defaultTranslation, args);
      }
    }

    // No translation found - return key
    this.logger.warn(
      `No translation found for key: ${key} in language: ${lang}`,
    );
    return key;
  }

  /**
   * Simple string interpolation for arguments
   */
  private interpolateArgs(
    template: string,
    args?: Record<string, any>,
  ): string {
    if (!args) return template;

    return Object.keys(args).reduce((result, key) => {
      return result.replace(new RegExp(`{${key}}`, 'g'), String(args[key]));
    }, template);
  }

  getLanguageMetadata(lang: SupportedLanguage) {
    return LanguageMetadata[lang];
  }

  getSupportedLanguagesWithMetadata() {
    return Object.values(SupportedLanguage).map((lang) => ({
      code: lang,
      ...this.getLanguageMetadata(lang),
    }));
  }

  validateLanguage(lang: string): SupportedLanguage {
    if (!isValidLanguage(lang)) {
      this.logger.warn(
        `Unsupported language requested: ${lang}, falling back to default`,
      );
      return this.getDefaultLanguage();
    }
    return lang;
  }

  prismaToSupported(prismaLang: string): SupportedLanguage {
    const langMap: Record<string, SupportedLanguage> = {
      ID: SupportedLanguage.INDONESIAN,
      EN: SupportedLanguage.ENGLISH,
      ZH: SupportedLanguage.CHINESE,
    };

    return langMap[prismaLang] || this.getDefaultLanguage();
  }

  supportedToPrisma(supportedLang: SupportedLanguage): string {
    const langMap: Record<SupportedLanguage, string> = {
      [SupportedLanguage.INDONESIAN]: 'ID',
      [SupportedLanguage.ENGLISH]: 'EN',
      [SupportedLanguage.CHINESE]: 'ZH',
    };

    return langMap[supportedLang] || 'ID';
  }

  isSupported(lang: string): lang is SupportedLanguage {
    return isValidLanguage(lang);
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return Object.values(SupportedLanguage);
  }

  getNativeName(lang: SupportedLanguage): string {
    return this.getLanguageMetadata(lang).nativeName;
  }

  getEnglishName(lang: SupportedLanguage): string {
    return this.getLanguageMetadata(lang).name;
  }

  getLanguageFlag(lang: SupportedLanguage): string {
    return this.getLanguageMetadata(lang).flag;
  }

  getDisplayName(lang: SupportedLanguage): string {
    const metadata = this.getLanguageMetadata(lang);
    return `${metadata.flag} ${metadata.nativeName}`;
  }

  /**
   * Debug method to list all available translations
   */
  getAvailableTranslations(lang: SupportedLanguage): string[] {
    return Object.keys(this.translations[lang] || {});
  }

  /**
   * Check if a translation key exists
   */
  hasTranslation(key: string, lang: SupportedLanguage): boolean {
    return !!this.translations[lang]?.[key];
  }
}
