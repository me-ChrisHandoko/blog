import { Language } from '@prisma/client';
import { SupportedLanguage } from '../../i18n/constants/languages';

export class LanguageConverter {
  private static readonly SUPPORTED_TO_PRISMA: Record<
    SupportedLanguage,
    Language
  > = {
    [SupportedLanguage.INDONESIAN]: Language.ID,
    [SupportedLanguage.ENGLISH]: Language.EN,
    [SupportedLanguage.CHINESE]: Language.ZH,
  };

  private static readonly PRISMA_TO_SUPPORTED: Record<
    Language,
    SupportedLanguage
  > = {
    [Language.ID]: SupportedLanguage.INDONESIAN,
    [Language.EN]: SupportedLanguage.ENGLISH,
    [Language.ZH]: SupportedLanguage.CHINESE,
  };

  /**
   * Convert SupportedLanguage to Prisma Language enum
   */
  static toPrismaLanguage(supportedLang: SupportedLanguage): Language {
    return this.SUPPORTED_TO_PRISMA[supportedLang] || Language.ID;
  }

  /**
   * Convert Prisma Language enum to SupportedLanguage
   */
  static fromPrismaLanguage(prismaLang: Language): SupportedLanguage {
    return this.PRISMA_TO_SUPPORTED[prismaLang] || SupportedLanguage.INDONESIAN;
  }

  /**
   * Convert SupportedLanguage to string (for backward compatibility)
   */
  static toString(supportedLang: SupportedLanguage): string {
    return this.toPrismaLanguage(supportedLang);
  }

  /**
   * Validate and convert string to SupportedLanguage
   */
  static fromString(langString: string): SupportedLanguage {
    const prismaLang = langString as Language;
    return this.fromPrismaLanguage(prismaLang);
  }
}
