// src/i18n/constants/languages.ts - UPDATED WITH CHINESE SUPPORT
export type SupportedLanguage = 'EN' | 'ID' | 'ZH';

// ✅ UPDATED: Array with Chinese language
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  'EN',
  'ID',
  'ZH',
] as const;

// ✅ UPDATED: Enum-like object with Chinese
export const SupportedLanguageEnum = {
  ENGLISH: 'EN',
  INDONESIAN: 'ID',
  CHINESE: 'ZH',
} as const;

// ✅ Export individual constants
export const ENGLISH: SupportedLanguage = 'EN';
export const INDONESIAN: SupportedLanguage = 'ID';
export const CHINESE: SupportedLanguage = 'ZH';

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

// ✅ UPDATED: Language metadata with Chinese
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
  [CHINESE]: {
    displayName: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    code: 'zh',
    flag: '🇨🇳',
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
    IN: INDONESIAN,
    ZH: CHINESE,
    CHI: CHINESE,
    CHINESE: CHINESE,
    CN: CHINESE,
    'ZH-CN': CHINESE,
    'ZH-TW': CHINESE,
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
  const mapping = {
    [ENGLISH]: 'EN',
    [INDONESIAN]: 'ID',
    [CHINESE]: 'ZH',
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
    EN: ENGLISH,
    ID: INDONESIAN,
    ZH: CHINESE,
  };

  return mapping[prismaLang] || getDefaultLanguage();
}
