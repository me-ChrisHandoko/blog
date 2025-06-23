// src/i18n/constants/languages.ts - FIXED MAPPING TYPES FINAL
export type SupportedLanguage = 'EN' | 'ID';

// ✅ ADDED: Array for @IsIn validation
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  'EN',
  'ID',
] as const;

// ✅ ADDED: Enum-like object for @IsEnum validation (alternative)
export const SupportedLanguageEnum = {
  ENGLISH: 'EN',
  INDONESIAN: 'ID',
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

  // ✅ FIXED: Use explicit Record with string keys (not SupportedLanguage keys)
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
  // ✅ FIXED: Use explicit object literal instead of Record type
  const mapping = {
    [ENGLISH]: 'EN',
    [INDONESIAN]: 'ID',
  };

  return mapping[lang] || mapping[getDefaultLanguage()];
}

/**
 * Convert Prisma enum to SupportedLanguage
 */
export function prismaToSupportedLanguage(
  prismaLang: string,
): SupportedLanguage {
  // ✅ FIXED: Use explicit Record with string keys
  const mapping: Record<string, SupportedLanguage> = {
    EN: ENGLISH,
    ID: INDONESIAN,
  };

  return mapping[prismaLang] || getDefaultLanguage();
}
