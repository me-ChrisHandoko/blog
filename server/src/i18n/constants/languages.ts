// src/i18n/constants/languages.ts - ENHANCED WITH ENUM-LIKE CONSTANTS
export type SupportedLanguage = 'EN' | 'ID';

// ✅ Array for iteration
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  'EN',
  'ID',
] as const;

// ✅ Enum-like object for easy access (like SupportedLanguage.ENGLISH)
export const Language = {
  ENGLISH: 'EN' as const,
  INDONESIAN: 'ID' as const,
  // Add more as needed
} as const;

// ✅ Export individual constants for easier access
export const ENGLISH: SupportedLanguage = 'EN';
export const INDONESIAN: SupportedLanguage = 'ID';

export function getDefaultLanguage(): SupportedLanguage {
  return ENGLISH;
}

export interface LanguageMetadata {
  displayName: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  code: string;
  flag: string;
}

export const LANGUAGE_METADATA: Record<SupportedLanguage, LanguageMetadata> = {
  [ENGLISH]: {
    displayName: 'English',
    nativeName: 'English',
    direction: 'ltr',
    code: 'en',
    flag: '🇺🇸',
  },
  [INDONESIAN]: {
    displayName: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    direction: 'ltr',
    code: 'id',
    flag: '🇮🇩',
  },
};

/**
 * Map language codes to supported languages
 */
export function mapLanguageCode(code: string): SupportedLanguage {
  const normalizedCode = code.toUpperCase();

  const mapping: Record<string, SupportedLanguage> = {
    EN: ENGLISH,
    ENG: ENGLISH,
    ENGLISH: ENGLISH,
    ID: INDONESIAN,
    IND: INDONESIAN,
    INDONESIAN: INDONESIAN,
    IN: INDONESIAN, // Alternative
  };

  return mapping[normalizedCode] || getDefaultLanguage();
}

/**
 * Check if a language is supported
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

/**
 * Get language metadata safely
 */
export function getLanguageMetadata(lang: SupportedLanguage): LanguageMetadata {
  return LANGUAGE_METADATA[lang] || LANGUAGE_METADATA[getDefaultLanguage()];
}

/**
 * Validate and normalize language input
 */
export function validateLanguage(input: string): SupportedLanguage {
  if (!input) {
    return getDefaultLanguage();
  }

  const mapped = mapLanguageCode(input);
  return isSupportedLanguage(mapped) ? mapped : getDefaultLanguage();
}

/**
 * Convert SupportedLanguage to Prisma enum values
 */
export function supportedToPrismaLanguage(lang: SupportedLanguage): string {
  const mapping: Record<SupportedLanguage, string> = {
    [ENGLISH]: 'ENGLISH',
    [INDONESIAN]: 'INDONESIAN',
  };

  return mapping[lang] || mapping[getDefaultLanguage()];
}

/**
 * Convert Prisma enum to SupportedLanguage
 */
export function prismaToSupportedLanguage(
  prismaLang: string,
): SupportedLanguage {
  const mapping: Record<string, SupportedLanguage> = {
    ENGLISH: ENGLISH,
    INDONESIAN: INDONESIAN,
  };

  return mapping[prismaLang] || getDefaultLanguage();
}

// ✅ Helper object for scripts (backwards compatibility)
export const LanguageConstants = {
  ENGLISH,
  INDONESIAN,
  // Aliases for common usage patterns
  EN: ENGLISH,
  ID: INDONESIAN,
} as const;

// ✅ For scripts that expect enum-like behavior
export const SupportedLanguageEnum = Language;
