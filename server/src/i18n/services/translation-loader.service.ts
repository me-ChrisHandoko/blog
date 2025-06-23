// src/i18n/services/translation-loader.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  getDefaultLanguage,
} from '../constants/languages';

interface TranslationData {
  [key: string]: string | TranslationData;
}

@Injectable()
export class TranslationLoaderService {
  private readonly logger = new Logger(TranslationLoaderService.name);
  private readonly translations = new Map<string, TranslationData>();
  private readonly translationsPath = join(
    process.cwd(),
    'src',
    'i18n',
    'translations',
  );

  constructor() {
    this.loadAllTranslations();
  }

  /**
   * Load all translation files
   */
  private loadAllTranslations(): void {
    try {
      for (const lang of SUPPORTED_LANGUAGES) {
        this.loadLanguage(lang);
      }
      this.logger.log(
        `✅ Loaded translations for ${SUPPORTED_LANGUAGES.length} languages`,
      );
    } catch (error) {
      this.logger.error('Failed to load translations:', error);
    }
  }

  /**
   * Load translations for a specific language
   */
  async loadLanguage(lang: SupportedLanguage): Promise<void> {
    try {
      const languageCode = lang.toLowerCase();
      const filePath = join(this.translationsPath, `${languageCode}.json`);

      if (!existsSync(filePath)) {
        this.logger.warn(`Translation file not found: ${filePath}`);
        this.createDefaultTranslationFile(lang, filePath);
        return;
      }

      const fileContent = readFileSync(filePath, 'utf-8');
      const translationData = JSON.parse(fileContent);

      this.translations.set(lang, translationData);
      this.logger.debug(`Loaded translations for ${lang}`);
    } catch (error) {
      this.logger.error(`Failed to load ${lang} translations:`, error);
      this.createFallbackTranslations(lang);
    }
  }

  /**
   * Get translation for a specific key and language
   */
  getTranslation(key: string, lang: SupportedLanguage): string | null {
    try {
      const langTranslations = this.translations.get(lang);

      if (!langTranslations) {
        return this.getFallbackTranslation(key, lang);
      }

      const translation = this.getNestedValue(langTranslations, key);

      if (translation !== null) {
        return translation;
      }

      // Try fallback to default language
      return this.getFallbackTranslation(key, lang);
    } catch (error) {
      this.logger.error(
        `Error getting translation for ${key} (${lang}):`,
        error,
      );
      return null;
    }
  }

  /**
   * Get nested value from translation object using dot notation
   */
  private getNestedValue(obj: TranslationData, key: string): string | null {
    const keys = key.split('.');
    let current: any = obj;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * Get fallback translation
   */
  private getFallbackTranslation(
    key: string,
    requestedLang: SupportedLanguage,
  ): string | null {
    const defaultLang = getDefaultLanguage();

    // Don't fallback to the same language
    if (requestedLang === defaultLang) {
      return null;
    }

    const defaultTranslations = this.translations.get(defaultLang);
    if (!defaultTranslations) {
      return null;
    }

    return this.getNestedValue(defaultTranslations, key);
  }

  /**
   * Check if translation exists
   */
  hasTranslation(key: string, lang: SupportedLanguage): boolean {
    return this.getTranslation(key, lang) !== null;
  }

  /**
   * Get all translations for a language
   */
  getAllTranslations(lang: SupportedLanguage): TranslationData | null {
    return this.translations.get(lang) || null;
  }

  /**
   * Get all loaded languages
   */
  getLoadedLanguages(): SupportedLanguage[] {
    return Array.from(this.translations.keys()) as SupportedLanguage[];
  }

  /**
   * Reload translations for a language
   */
  async reloadLanguage(lang: SupportedLanguage): Promise<void> {
    this.translations.delete(lang);
    await this.loadLanguage(lang);
  }

  /**
   * Reload all translations
   */
  async reloadAllTranslations(): Promise<void> {
    this.translations.clear();
    this.loadAllTranslations();
  }

  /**
   * Get translation keys for a language
   */
  getTranslationKeys(lang: SupportedLanguage): string[] {
    const translations = this.translations.get(lang);
    if (!translations) {
      return [];
    }

    return this.extractKeys(translations);
  }

  /**
   * Extract all keys from nested translation object
   */
  private extractKeys(obj: TranslationData, prefix = ''): string[] {
    const keys: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        keys.push(fullKey);
      } else if (typeof value === 'object' && value !== null) {
        keys.push(...this.extractKeys(value, fullKey));
      }
    }

    return keys;
  }

  /**
   * Create default translation file if missing
   */
  private createDefaultTranslationFile(
    lang: SupportedLanguage,
    filePath: string,
  ): void {
    try {
      const defaultTranslations = this.getDefaultTranslations(lang);
      const content = JSON.stringify(defaultTranslations, null, 2);

      // In a real app, you'd write to file system
      // For now, just store in memory
      this.translations.set(lang, defaultTranslations);

      this.logger.log(`Created default translations for ${lang}`);
    } catch (error) {
      this.logger.error(
        `Failed to create default translations for ${lang}:`,
        error,
      );
    }
  }

  /**
   * Create fallback translations in memory
   */
  private createFallbackTranslations(lang: SupportedLanguage): void {
    const fallbackTranslations = this.getDefaultTranslations(lang);
    this.translations.set(lang, fallbackTranslations);
    this.logger.warn(`Using fallback translations for ${lang}`);
  }

  /**
   * Get default translations for a language
   */
  private getDefaultTranslations(lang: SupportedLanguage): TranslationData {
    if (lang === 'EN') {
      return {
        common: {
          messages: {
            success: 'Success',
            error: 'Error',
            notFound: 'Not Found',
            badRequest: 'Bad Request',
            internalError: 'Internal Server Error',
            loading: 'Loading...',
            saving: 'Saving...',
            saved: 'Saved',
            cancel: 'Cancel',
            confirm: 'Confirm',
            delete: 'Delete',
            edit: 'Edit',
            create: 'Create',
            update: 'Update',
          },
        },
        auth: {
          messages: {
            unauthorized: 'Unauthorized',
            forbidden: 'Forbidden',
            invalidCredentials: 'Invalid credentials',
            loginFailed: 'Login failed',
            invalidToken: 'Invalid token',
            tokenExpired: 'Token expired',
            loginRequired: 'Login required',
          },
        },
        validation: {
          messages: {
            required: 'This field is required',
            email: 'Please enter a valid email',
            minLength: 'Minimum length is {{min}} characters',
            maxLength: 'Maximum length is {{max}} characters',
            failed: 'Validation failed',
          },
          password: {
            mismatch: 'Password confirmation does not match',
            weak: 'Password is too weak',
            required: 'Password is required',
          },
          email: {
            invalid: 'Invalid email format',
            alreadyExists: 'Email already exists',
            required: 'Email is required',
          },
        },
        users: {
          messages: {
            created: 'User created successfully',
            updated: 'User updated successfully',
            deleted: 'User deleted successfully',
            notFound: 'User not found',
            listEmpty: 'No users found',
          },
        },
      };
    } else if (lang === 'ID') {
      return {
        common: {
          messages: {
            success: 'Berhasil',
            error: 'Kesalahan',
            notFound: 'Tidak Ditemukan',
            badRequest: 'Permintaan Tidak Valid',
            internalError: 'Kesalahan Server Internal',
            loading: 'Memuat...',
            saving: 'Menyimpan...',
            saved: 'Tersimpan',
            cancel: 'Batal',
            confirm: 'Konfirmasi',
            delete: 'Hapus',
            edit: 'Edit',
            create: 'Buat',
            update: 'Perbarui',
          },
        },
        auth: {
          messages: {
            unauthorized: 'Tidak Diizinkan',
            forbidden: 'Dilarang',
            invalidCredentials: 'Kredensial tidak valid',
            loginFailed: 'Login gagal',
            invalidToken: 'Token tidak valid',
            tokenExpired: 'Token kedaluwarsa',
            loginRequired: 'Login diperlukan',
          },
        },
        validation: {
          messages: {
            required: 'Field ini wajib diisi',
            email: 'Silakan masukkan email yang valid',
            minLength: 'Panjang minimum adalah {{min}} karakter',
            maxLength: 'Panjang maksimum adalah {{max}} karakter',
            failed: 'Validasi gagal',
          },
          password: {
            mismatch: 'Konfirmasi password tidak cocok',
            weak: 'Password terlalu lemah',
            required: 'Password wajib diisi',
          },
          email: {
            invalid: 'Format email tidak valid',
            alreadyExists: 'Email sudah ada',
            required: 'Email wajib diisi',
          },
        },
        users: {
          messages: {
            created: 'User berhasil dibuat',
            updated: 'User berhasil diperbarui',
            deleted: 'User berhasil dihapus',
            notFound: 'User tidak ditemukan',
            listEmpty: 'Tidak ada user ditemukan',
          },
        },
      };
    }

    // Fallback to English
    return this.getDefaultTranslations('EN');
  }

  /**
   * Get translation statistics
   */
  getStats(): {
    loadedLanguages: number;
    totalKeys: Record<SupportedLanguage, number>;
    missingKeys: string[];
  } {
    const totalKeys: Record<SupportedLanguage, number> = {} as any;
    const allKeys = new Set<string>();

    // Collect all keys from all languages
    for (const lang of SUPPORTED_LANGUAGES) {
      const keys = this.getTranslationKeys(lang);
      totalKeys[lang] = keys.length;
      keys.forEach((key) => allKeys.add(key));
    }

    // Find missing keys
    const missingKeys: string[] = [];
    for (const key of allKeys) {
      for (const lang of SUPPORTED_LANGUAGES) {
        if (!this.hasTranslation(key, lang)) {
          missingKeys.push(`${key} (${lang})`);
        }
      }
    }

    return {
      loadedLanguages: this.getLoadedLanguages().length,
      totalKeys,
      missingKeys,
    };
  }
}
