// src/i18n/services/language.service.ts - FIXED Cache Implementation
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SupportedLanguage,
  LanguageMetadata,
  isValidLanguage,
  getDefaultLanguage,
} from '../constants/languages';
import * as fs from 'fs';
import * as path from 'path';

// Translation interfaces for better type safety
interface TranslationFile {
  [key: string]: string | TranslationFile;
}

interface LoadedTranslations {
  [SupportedLanguage.INDONESIAN]: TranslationFile;
  [SupportedLanguage.ENGLISH]: TranslationFile;
  [SupportedLanguage.CHINESE]: TranslationFile;
}

/**
 * Enhanced File-Based Language Service with Optimized Cache
 */
@Injectable()
export class LanguageService implements OnModuleInit {
  private readonly logger = new Logger(LanguageService.name);
  private translations: LoadedTranslations;
  private readonly translationsPath: string;

  // FIXED: Optimized cache with size limit
  private translationCache = new Map<string, string>();
  private readonly MAX_CACHE_SIZE = 1000; // Limit cache size to prevent memory leaks

  constructor() {
    this.translationsPath = path.join(
      process.cwd(),
      'src',
      'i18n',
      'translations',
    );
    this.translations = {} as LoadedTranslations;
  }

  async onModuleInit(): Promise<void> {
    await this.loadTranslations();
    this.logger.log('✅ File-based translations loaded successfully');
  }

  /**
   * Load all translation files from the translations directory
   */
  private async loadTranslations(): Promise<void> {
    try {
      const supportedLanguages = this.getSupportedLanguages();

      for (const lang of supportedLanguages) {
        this.translations[lang] = await this.loadLanguageTranslations(lang);
      }

      this.logger.log(
        `📁 Loaded translations for ${supportedLanguages.length} languages`,
      );
      this.validateLoadedTranslations();
    } catch (error) {
      this.logger.error('❌ Failed to load translations:', error);
      throw error;
    }
  }

  /**
   * Load translation files for a specific language
   */
  private async loadLanguageTranslations(
    language: SupportedLanguage,
  ): Promise<TranslationFile> {
    const langPath = path.join(this.translationsPath, language);

    if (!fs.existsSync(langPath)) {
      this.logger.warn(
        `⚠️  Translation directory not found for language: ${language}`,
      );
      return {};
    }

    const translationFiles = await this.getTranslationFiles(langPath);
    const mergedTranslations: TranslationFile = {};

    for (const file of translationFiles) {
      const filePath = path.join(langPath, file);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(fileContent);
        const fileKey = path.basename(file, '.json');

        mergedTranslations[fileKey] = parsed;
        this.logger.debug(`📄 Loaded ${file} for ${language}`);
      } catch (error) {
        this.logger.error(
          `❌ Failed to load translation file: ${filePath}`,
          error,
        );
      }
    }

    return mergedTranslations;
  }

  /**
   * Get all JSON translation files in a directory
   */
  private async getTranslationFiles(dirPath: string): Promise<string[]> {
    try {
      const files = fs.readdirSync(dirPath);
      return files.filter((file) => file.endsWith('.json'));
    } catch (error) {
      this.logger.error(
        `Failed to read translation directory: ${dirPath}`,
        error,
      );
      return [];
    }
  }

  /**
   * Validate that all languages have consistent translation keys
   */
  private validateLoadedTranslations(): void {
    const supportedLanguages = this.getSupportedLanguages();
    const [defaultLang, ...otherLangs] = supportedLanguages;
    const defaultKeys = this.getAllKeysFromTranslation(
      this.translations[defaultLang],
    );

    let totalMissingKeys = 0;

    for (const lang of otherLangs) {
      const langKeys = this.getAllKeysFromTranslation(this.translations[lang]);
      const missingKeys = defaultKeys.filter((key) => !langKeys.includes(key));

      if (missingKeys.length > 0) {
        totalMissingKeys += missingKeys.length;
        this.logger.warn(
          `⚠️  Missing ${missingKeys.length} translation keys in ${lang}:`,
          missingKeys.slice(0, 5),
        );
      }
    }

    if (totalMissingKeys === 0) {
      this.logger.log(
        '✅ All translation keys are consistent across languages',
      );
    } else {
      this.logger.warn(
        `⚠️  Found ${totalMissingKeys} missing translation keys across languages`,
      );
    }
  }

  /**
   * Get all translation keys from a translation object (flattened)
   */
  private getAllKeysFromTranslation(
    translation: TranslationFile,
    prefix: string = '',
  ): string[] {
    const keys: string[] = [];

    for (const [key, value] of Object.entries(translation)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        keys.push(fullKey);
      } else if (typeof value === 'object' && value !== null) {
        keys.push(...this.getAllKeysFromTranslation(value, fullKey));
      }
    }

    return keys;
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
   * FIXED: Main translation method with optimized caching
   */
  translate(
    key: string,
    lang: SupportedLanguage,
    args?: Record<string, any>,
  ): string {
    // Input validation
    if (!key || typeof key !== 'string') {
      this.logger.warn(`Invalid translation key provided: ${key}`);
      return key || '';
    }

    // Create cache key
    const cacheKey = `${lang}:${key}:${args ? JSON.stringify(args) : ''}`;

    // Check cache first
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!;
    }

    // Get translation using path notation (e.g., 'auth.messages.loginSuccess')
    let translation = this.getNestedTranslation(key, lang);

    if (!translation) {
      // Try default language as fallback
      if (lang !== this.getDefaultLanguage()) {
        translation = this.getNestedTranslation(key, this.getDefaultLanguage());
        if (translation) {
          this.logger.debug(
            `Using default language translation for key: ${key}`,
          );
        }
      }
    }

    if (!translation) {
      // No translation found - return key
      this.logger.warn(
        `No translation found for key: ${key} in language: ${lang}`,
      );
      translation = key;
    }

    // Interpolate arguments
    const result = this.interpolateArgs(translation, args);

    // FIXED: Implement LRU-style cache cleanup to prevent memory leaks
    if (this.translationCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries (first 100 entries)
      const keysToDelete = Array.from(this.translationCache.keys()).slice(
        0,
        100,
      );
      keysToDelete.forEach((keyToDelete) => {
        this.translationCache.delete(keyToDelete);
      });

      this.logger.debug(
        `🗑️  Cache cleanup: removed ${keysToDelete.length} old entries`,
      );
    }

    // Cache the result
    this.translationCache.set(cacheKey, result);

    return result;
  }

  /**
   * Get nested translation using dot notation
   */
  private getNestedTranslation(
    key: string,
    lang: SupportedLanguage,
  ): string | null {
    if (!this.translations[lang]) {
      return null;
    }

    const pathParts = key.split('.');
    let current: any = this.translations[lang];

    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * Type-safe translation methods for specific modules
   */
  translateAuth(key: string, lang: SupportedLanguage): string {
    return this.translate(`auth.messages.${key}`, lang);
  }

  translateUsers(
    key: string,
    category: 'messages' | 'roles',
    lang: SupportedLanguage,
  ): string {
    return this.translate(`users.${category}.${key}`, lang);
  }

  translateValidation(
    category: string,
    key: string,
    lang: SupportedLanguage,
    args?: Record<string, any>,
  ): string {
    return this.translate(`validation.${category}.${key}`, lang, args);
  }

  translateCommon(
    category: string,
    key: string,
    lang: SupportedLanguage,
    args?: Record<string, any>,
  ): string {
    return this.translate(`common.${category}.${key}`, lang, args);
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

  /**
   * Reload translations (useful for development)
   */
  async reloadTranslations(): Promise<void> {
    this.logger.log('🔄 Reloading translations...');
    this.translationCache.clear();
    await this.loadTranslations();
  }

  /**
   * Get translation from specific file
   */
  getTranslationFromFile(
    fileName: string,
    key: string,
    lang: SupportedLanguage,
  ): string | null {
    const fileTranslations = this.translations[lang]?.[fileName];
    if (!fileTranslations) return null;

    const pathParts = key.split('.');
    let current: any = fileTranslations;

    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * Get all available files for a language
   */
  getAvailableFiles(lang: SupportedLanguage): string[] {
    if (!this.translations[lang]) return [];
    return Object.keys(this.translations[lang]);
  }

  /**
   * Check if a translation file exists
   */
  hasTranslationFile(fileName: string, lang: SupportedLanguage): boolean {
    return !!(this.translations[lang] && this.translations[lang][fileName]);
  }

  // All other methods remain the same...
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
    if (!this.translations[lang]) return [];
    return this.getAllKeysFromTranslation(this.translations[lang]);
  }

  /**
   * Check if a translation key exists
   */
  hasTranslation(key: string, lang: SupportedLanguage): boolean {
    return this.getNestedTranslation(key, lang) !== null;
  }

  /**
   * Get all translations for a specific section (for debugging)
   */
  getTranslationSection(section: string, lang: SupportedLanguage): any {
    return this.translations[lang]?.[section] || null;
  }

  /**
   * IMPROVED: Get cache statistics with memory usage info
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    keys: string[];
    memoryEstimate: string;
  } {
    // Rough estimate of memory usage
    const avgKeySize = 50; // average bytes per cache key+value
    const memoryBytes = this.translationCache.size * avgKeySize;
    const memoryMB = (memoryBytes / 1024 / 1024).toFixed(2);

    return {
      size: this.translationCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      keys: Array.from(this.translationCache.keys()).slice(0, 10), // First 10 keys for debugging
      memoryEstimate: `~${memoryMB} MB`,
    };
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    const previousSize = this.translationCache.size;
    this.translationCache.clear();
    this.logger.log(
      `🗑️  Translation cache cleared (${previousSize} entries removed)`,
    );
  }

  /**
   * Get file modification stats (for cache invalidation)
   */
  getFileStats(): Record<SupportedLanguage, Record<string, any>> {
    const stats: Record<SupportedLanguage, Record<string, any>> = {} as any;

    for (const lang of this.getSupportedLanguages()) {
      stats[lang] = {};
      const langPath = path.join(this.translationsPath, lang);

      if (fs.existsSync(langPath)) {
        const files = fs
          .readdirSync(langPath)
          .filter((file) => file.endsWith('.json'));

        for (const file of files) {
          const filePath = path.join(langPath, file);
          try {
            const stat = fs.statSync(filePath);
            stats[lang][file] = {
              size: stat.size,
              modified: stat.mtime,
              exists: true,
            };
          } catch (error) {
            stats[lang][file] = {
              exists: false,
              error: error.message,
            };
          }
        }
      }
    }

    return stats;
  }
}
