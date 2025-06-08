export enum SupportedLanguage {
  INDONESIAN = 'id',
  ENGLISH = 'en',
  CHINESE = 'zh',
}

export const LanguageMetadata = {
  [SupportedLanguage.INDONESIAN]: {
    name: 'Bahasa Indonesia',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    direction: 'ltr', // left-to-right
  },
  [SupportedLanguage.ENGLISH]: {
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr', // left-to-right
  },
  [SupportedLanguage.CHINESE]: {
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    direction: 'ltr', // left-to-right
  },
} as const;

// Helper functions
export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return Object.values(SupportedLanguage).includes(lang as SupportedLanguage);
}

export function getDefaultLanguage(): SupportedLanguage {
  return SupportedLanguage.INDONESIAN;
}

export function getSupportedLanguages(): SupportedLanguage[] {
  return Object.values(SupportedLanguage);
}
