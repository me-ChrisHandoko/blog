// src/i18n/services/translation-cache.service.ts - NEW FILE
import { Injectable, Logger } from '@nestjs/common';
import { LRUCache } from '../../common/cache/lru-cache';
import { SupportedLanguage } from '../constants/languages';

export interface CacheEntry {
  value: string;
  timestamp: number;
  language: SupportedLanguage;
  hitCount: number;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: string;
  oldestEntry?: Date;
  newestEntry?: Date;
}

@Injectable()
export class TranslationCacheService {
  private readonly logger = new Logger(TranslationCacheService.name);
  private readonly cache: LRUCache<string, string>;
  private readonly defaultTTL = 300; // 5 minutes
  private stats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
  };

  constructor() {
    // Initialize cache with reasonable size for translations
    this.cache = new LRUCache<string, string>(5000);
    this.logger.log('✅ TranslationCacheService initialized');
  }

  /**
   * Generate cache key from translation key and language
   */
  private generateCacheKey(key: string, language: SupportedLanguage): string {
    return `${language}:${key}`;
  }

  /**
   * Get translation from cache
   */
  get(key: string, language: SupportedLanguage): string | undefined {
    this.stats.totalRequests++;

    const cacheKey = this.generateCacheKey(key, language);
    const cachedValue = this.cache.get(cacheKey);

    if (cachedValue) {
      this.stats.hits++;
      return cachedValue;
    }

    this.stats.misses++;
    return undefined;
  }

  /**
   * Set translation in cache
   */
  set(key: string, language: SupportedLanguage, value: string): void {
    const cacheKey = this.generateCacheKey(key, language);
    this.cache.set(cacheKey, value);
  }

  /**
   * Check if translation exists in cache
   */
  has(key: string, language: SupportedLanguage): boolean {
    const cacheKey = this.generateCacheKey(key, language);
    return this.cache.has(cacheKey);
  }

  /**
   * Remove translation from cache
   */
  delete(key: string, language: SupportedLanguage): boolean {
    const cacheKey = this.generateCacheKey(key, language);
    return this.cache.delete(cacheKey);
  }

  /**
   * Clear all cached translations
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
    this.logger.log('🗑️ Translation cache cleared');
  }

  /**
   * Clear cache for specific language
   */
  clearLanguage(language: SupportedLanguage): void {
    const keysToDelete: string[] = [];

    // Find all keys for the specified language
    const exportData = this.cache.exportData();
    for (const entry of exportData) {
      if (
        typeof entry.key === 'string' &&
        entry.key.startsWith(`${language}:`)
      ) {
        keysToDelete.push(entry.key);
      }
    }

    // Delete found keys
    keysToDelete.forEach((key) => {
      this.cache.delete(key);
    });

    this.logger.log(`🗑️ Translation cache cleared for language: ${language}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const cacheMetrics = this.cache.getMetrics();
    const hitRate =
      this.stats.totalRequests > 0
        ? (this.stats.hits / this.stats.totalRequests) * 100
        : 0;
    const missRate = 100 - hitRate;

    return {
      totalEntries: cacheMetrics.size,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      memoryUsage: cacheMetrics.memoryEstimate,
      oldestEntry: cacheMetrics.oldestEntry
        ? new Date(cacheMetrics.oldestEntry)
        : undefined,
      newestEntry: cacheMetrics.newestEntry
        ? new Date(cacheMetrics.newestEntry)
        : undefined,
    };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size();
  }

  /**
   * Get most accessed translations
   */
  getMostAccessed(limit: number = 10): Array<{
    key: string;
    value: string;
    accessCount: number;
  }> {
    return this.cache.getMostAccessed(limit);
  }

  /**
   * Get least accessed translations
   */
  getLeastAccessed(limit: number = 10): Array<{
    key: string;
    value: string;
    accessCount: number;
  }> {
    return this.cache.getLeastAccessed(limit);
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
    };
    this.cache.resetMetrics();
  }

  /**
   * Get cache health information
   */
  getHealthInfo(): {
    status: 'healthy' | 'degraded' | 'critical';
    details: {
      hitRate: number;
      memoryUsage: string;
      totalEntries: number;
      maxEntries: number;
      utilizationRate: number;
    };
    recommendations: string[];
  } {
    const stats = this.getStats();
    const cacheMetrics = this.cache.getMetrics();
    const utilizationRate = (cacheMetrics.size / cacheMetrics.maxSize) * 100;

    let status: 'healthy' | 'degraded' | 'critical';
    const recommendations: string[] = [];

    if (stats.hitRate < 50 || utilizationRate > 90) {
      status = 'critical';
      if (stats.hitRate < 50) {
        recommendations.push(
          'Low cache hit rate - consider cache warming strategies',
        );
      }
      if (utilizationRate > 90) {
        recommendations.push(
          'Cache near capacity - consider increasing cache size',
        );
      }
    } else if (stats.hitRate < 70 || utilizationRate > 75) {
      status = 'degraded';
      if (stats.hitRate < 70) {
        recommendations.push('Cache hit rate could be improved');
      }
      if (utilizationRate > 75) {
        recommendations.push('Cache utilization is high');
      }
    } else {
      status = 'healthy';
      recommendations.push('Cache performance is optimal');
    }

    return {
      status,
      details: {
        hitRate: stats.hitRate,
        memoryUsage: stats.memoryUsage,
        totalEntries: stats.totalEntries,
        maxEntries: cacheMetrics.maxSize,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
      },
      recommendations,
    };
  }

  /**
   * Preload translations into cache
   */
  preload(
    translations: Array<{
      key: string;
      language: SupportedLanguage;
      value: string;
    }>,
  ): void {
    translations.forEach(({ key, language, value }) => {
      this.set(key, language, value);
    });

    this.logger.log(
      `📥 Preloaded ${translations.length} translations into cache`,
    );
  }

  /**
   * Export cache data for backup
   */
  exportCache(): Array<{
    key: string;
    language: SupportedLanguage;
    value: string;
    timestamp: Date;
  }> {
    const exportData = this.cache.exportData();

    return exportData.map((entry) => {
      const [language, translationKey] = entry.key.split(':', 2);
      return {
        key: translationKey,
        language: language as SupportedLanguage,
        value: entry.value,
        timestamp: entry.createdAt,
      };
    });
  }

  /**
   * Import cache data from backup
   */
  importCache(
    data: Array<{
      key: string;
      language: SupportedLanguage;
      value: string;
    }>,
  ): void {
    data.forEach(({ key, language, value }) => {
      this.set(key, language, value);
    });

    this.logger.log(`📤 Imported ${data.length} translations into cache`);
  }
}
