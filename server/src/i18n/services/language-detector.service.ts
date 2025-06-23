// src/i18n/services/language-detector.service.ts - FIXED SOURCE TYPES
import { Injectable, Logger } from '@nestjs/common';
import {
  SupportedLanguage,
  getDefaultLanguage,
  SUPPORTED_LANGUAGES,
} from '../constants/languages';

export interface DetectionSources {
  query?: string;
  header?: string;
  acceptLanguage?: string;
  userPreference?: SupportedLanguage;
  cookie?: string;
  subdomain?: string;
  path?: string;
}

export interface DetectionResult {
  language: SupportedLanguage;
  // ✅ FIXED: Use literal types instead of keyof DetectionSources
  source:
    | 'query'
    | 'header'
    | 'userPreference'
    | 'acceptLanguage'
    | 'cookie'
    | 'subdomain'
    | 'path'
    | 'default';
  confidence: number; // 0-1 scale
  alternatives: SupportedLanguage[];
}

export interface DetectionConfig {
  priorityOrder: Array<keyof DetectionSources>;
  fallbackToDefault: boolean;
  enableAcceptLanguageParsing: boolean;
  enableSubdomainDetection: boolean;
  enablePathDetection: boolean;
}

@Injectable()
export class LanguageDetectorService {
  private readonly logger = new Logger(LanguageDetectorService.name);
  private readonly defaultConfig: DetectionConfig = {
    priorityOrder: [
      'userPreference',
      'query',
      'header',
      'cookie',
      'acceptLanguage',
    ],
    fallbackToDefault: true,
    enableAcceptLanguageParsing: true,
    enableSubdomainDetection: false,
    enablePathDetection: false,
  };

  constructor() {
    this.logger.log('✅ LanguageDetectorService initialized');
  }

  /**
   * Detect language from request with detailed analysis
   */
  detectLanguage(
    sources: DetectionSources,
    config: Partial<DetectionConfig> = {},
  ): DetectionResult {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const alternatives: SupportedLanguage[] = [];

    // Try each detection method in priority order
    for (const sourceType of mergedConfig.priorityOrder) {
      const result = this.detectFromSource(sourceType, sources, alternatives);
      if (result) {
        return result;
      }
    }

    // Fallback to default
    if (mergedConfig.fallbackToDefault) {
      return {
        language: getDefaultLanguage(),
        source: 'default',
        confidence: 1.0,
        alternatives: alternatives.filter(
          (lang) => lang !== getDefaultLanguage(),
        ),
      };
    }

    throw new Error('No language could be detected and fallback is disabled');
  }

  /**
   * Simple language detection (for backward compatibility)
   */
  detectFromRequest(headers: any, query: any): SupportedLanguage {
    const sources: DetectionSources = {
      query: query?.lang || query?.language,
      header: headers?.['x-language'] || headers?.['x-lang'],
      acceptLanguage: headers?.['accept-language'],
    };

    const result = this.detectLanguage(sources);
    return result.language;
  }

  /**
   * Detect language with confidence scoring
   */
  detectWithConfidence(sources: DetectionSources): Array<{
    language: SupportedLanguage;
    confidence: number;
    source: string;
  }> {
    const results: Array<{
      language: SupportedLanguage;
      confidence: number;
      source: string;
    }> = [];

    // Check each source and score confidence
    if (sources.userPreference) {
      results.push({
        language: sources.userPreference,
        confidence: 1.0,
        source: 'userPreference',
      });
    }

    if (sources.query) {
      const lang = this.validateAndNormalize(sources.query);
      if (lang) {
        results.push({
          language: lang,
          confidence: 0.9,
          source: 'query',
        });
      }
    }

    if (sources.header) {
      const lang = this.validateAndNormalize(sources.header);
      if (lang) {
        results.push({
          language: lang,
          confidence: 0.8,
          source: 'header',
        });
      }
    }

    if (sources.acceptLanguage) {
      const detected = this.parseAcceptLanguage(sources.acceptLanguage);
      detected.forEach((item, index) => {
        results.push({
          language: item.language,
          confidence: item.quality * (0.7 - index * 0.1),
          source: 'acceptLanguage',
        });
      });
    }

    // Sort by confidence (highest first)
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Parse Accept-Language header with quality values
   */
  parseAcceptLanguage(acceptLanguage: string): Array<{
    language: SupportedLanguage;
    quality: number;
  }> {
    try {
      const results: Array<{ language: SupportedLanguage; quality: number }> =
        [];

      // Parse Accept-Language header
      const languages = acceptLanguage.split(',').map((lang) => lang.trim());

      for (const langEntry of languages) {
        const [langCode, qualityStr] = langEntry.split(';');
        const quality = qualityStr
          ? parseFloat(qualityStr.split('=')[1]) || 1.0
          : 1.0;

        // Extract language code (first 2 characters)
        const normalizedLang = langCode.trim().substring(0, 2).toUpperCase();
        const supportedLang = this.mapToSupportedLanguage(normalizedLang);

        if (supportedLang) {
          results.push({
            language: supportedLang,
            quality: Math.min(Math.max(quality, 0), 1), // Clamp between 0-1
          });
        }
      }

      // Sort by quality (highest first) and remove duplicates
      const uniqueResults = results.reduce(
        (acc, current) => {
          const existing = acc.find(
            (item) => item.language === current.language,
          );
          if (!existing || existing.quality < current.quality) {
            return [
              ...acc.filter((item) => item.language !== current.language),
              current,
            ];
          }
          return acc;
        },
        [] as Array<{ language: SupportedLanguage; quality: number }>,
      );

      return uniqueResults.sort((a, b) => b.quality - a.quality);
    } catch (error) {
      this.logger.warn('Failed to parse Accept-Language header:', error);
      return [];
    }
  }

  /**
   * Detect language from subdomain (e.g., en.example.com)
   */
  detectFromSubdomain(hostname: string): SupportedLanguage | null {
    try {
      const subdomain = hostname.split('.')[0];
      return this.validateAndNormalize(subdomain);
    } catch (error) {
      this.logger.warn('Failed to detect language from subdomain:', error);
      return null;
    }
  }

  /**
   * Detect language from URL path (e.g., /en/page)
   */
  detectFromPath(pathname: string): SupportedLanguage | null {
    try {
      const pathSegments = pathname
        .split('/')
        .filter((segment) => segment.length > 0);
      if (pathSegments.length > 0) {
        return this.validateAndNormalize(pathSegments[0]);
      }
      return null;
    } catch (error) {
      this.logger.warn('Failed to detect language from path:', error);
      return null;
    }
  }

  /**
   * Detect language from cookie
   */
  detectFromCookie(
    cookieString: string,
    cookieName: string = 'language',
  ): SupportedLanguage | null {
    try {
      const cookies = this.parseCookies(cookieString);
      const languageValue = cookies[cookieName];
      return languageValue ? this.validateAndNormalize(languageValue) : null;
    } catch (error) {
      this.logger.warn('Failed to detect language from cookie:', error);
      return null;
    }
  }

  /**
   * Get detection statistics
   */
  getDetectionStats(sources: DetectionSources): {
    availableSources: number;
    detectedLanguages: SupportedLanguage[];
    primarySource: string;
    confidence: number;
  } {
    const availableSources = Object.keys(sources).filter(
      (key) => sources[key],
    ).length;
    const detectionResults = this.detectWithConfidence(sources);

    return {
      availableSources,
      detectedLanguages: detectionResults.map((r) => r.language),
      primarySource: detectionResults[0]?.source || 'none',
      confidence: detectionResults[0]?.confidence || 0,
    };
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Detect from specific source type
   */
  private detectFromSource(
    sourceType: keyof DetectionSources,
    sources: DetectionSources,
    alternatives: SupportedLanguage[],
  ): DetectionResult | null {
    let detectedLang: SupportedLanguage | null = null;
    let confidence = 1.0;
    // ✅ FIXED: Map sourceType to proper literal type
    let mappedSource: DetectionResult['source'] = 'default';

    switch (sourceType) {
      case 'userPreference':
        if (sources.userPreference) {
          detectedLang = sources.userPreference;
          confidence = 1.0;
          mappedSource = 'userPreference';
        }
        break;

      case 'query':
        if (sources.query) {
          detectedLang = this.validateAndNormalize(sources.query);
          confidence = 0.9;
          mappedSource = 'query';
        }
        break;

      case 'header':
        if (sources.header) {
          detectedLang = this.validateAndNormalize(sources.header);
          confidence = 0.8;
          mappedSource = 'header';
        }
        break;

      case 'cookie':
        if (sources.cookie) {
          detectedLang = this.detectFromCookie(sources.cookie);
          confidence = 0.7;
          mappedSource = 'cookie';
        }
        break;

      case 'acceptLanguage':
        if (sources.acceptLanguage) {
          const parsed = this.parseAcceptLanguage(sources.acceptLanguage);
          if (parsed.length > 0) {
            detectedLang = parsed[0].language;
            confidence = parsed[0].quality * 0.6;
            mappedSource = 'acceptLanguage';
            // Add alternatives
            parsed.slice(1).forEach((item) => {
              if (!alternatives.includes(item.language)) {
                alternatives.push(item.language);
              }
            });
          }
        }
        break;

      case 'subdomain':
        if (sources.subdomain) {
          detectedLang = this.detectFromSubdomain(sources.subdomain);
          confidence = 0.5;
          mappedSource = 'subdomain';
        }
        break;

      case 'path':
        if (sources.path) {
          detectedLang = this.detectFromPath(sources.path);
          confidence = 0.4;
          mappedSource = 'path';
        }
        break;
    }

    if (detectedLang) {
      return {
        language: detectedLang,
        source: mappedSource,
        confidence,
        alternatives: alternatives.filter((lang) => lang !== detectedLang),
      };
    }

    return null;
  }

  /**
   * Validate and normalize language input
   */
  private validateLanguage(lang: string): SupportedLanguage | null {
    const upperLang = lang?.toUpperCase();
    return SUPPORTED_LANGUAGES.includes(upperLang as SupportedLanguage)
      ? (upperLang as SupportedLanguage)
      : null;
  }

  /**
   * Validate and normalize language input with mapping
   */
  private validateAndNormalize(input: string): SupportedLanguage | null {
    if (!input || typeof input !== 'string') {
      return null;
    }

    const normalized = input.trim().toUpperCase();

    // Direct match first
    if (SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
      return normalized as SupportedLanguage;
    }

    // Try mapping
    return this.mapToSupportedLanguage(normalized);
  }

  /**
   * Map language code to supported language
   */
  private mapToSupportedLanguage(langCode: string): SupportedLanguage | null {
    const mapping: Record<string, SupportedLanguage> = {
      EN: 'EN',
      ENG: 'EN',
      ENGLISH: 'EN',
      ID: 'ID',
      IND: 'ID',
      INDONESIAN: 'ID',
      IN: 'ID', // Alternative for Indonesian
    };

    return mapping[langCode.toUpperCase()] || null;
  }

  /**
   * Parse cookie string into key-value pairs
   */
  private parseCookies(cookieString: string): Record<string, string> {
    const cookies: Record<string, string> = {};

    try {
      cookieString.split(';').forEach((cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) {
          cookies[key] = decodeURIComponent(value);
        }
      });
    } catch (error) {
      this.logger.warn('Failed to parse cookies:', error);
    }

    return cookies;
  }

  /**
   * Create detection sources from Express.js request
   */
  createDetectionSources(req: any): DetectionSources {
    return {
      query: req.query?.lang || req.query?.language,
      header: req.headers?.['x-language'] || req.headers?.['x-lang'],
      acceptLanguage: req.headers?.['accept-language'],
      userPreference: req.user?.preferredLanguage,
      cookie: req.headers?.cookie,
      subdomain: req.hostname,
      path: req.path,
    };
  }

  /**
   * Create detection sources from Fastify request
   */
  createDetectionSourcesFromFastify(req: any): DetectionSources {
    return {
      query: req.query?.lang || req.query?.language,
      header: req.headers?.['x-language'] || req.headers?.['x-lang'],
      acceptLanguage: req.headers?.['accept-language'],
      userPreference: req.user?.preferredLanguage,
      cookie: req.headers?.cookie,
      subdomain: req.hostname,
      path: req.url?.split('?')[0], // Remove query string
    };
  }
}
