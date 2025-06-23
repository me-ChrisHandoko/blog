import { Language } from '@prisma/client';
import { SupportedLanguage } from '../../i18n/constants/languages';

export class LanguageConverter {
  private static readonly SUPPORTED_TO_PRISMA: Record<
    SupportedLanguage,
    Language
  > = {
    EN: Language.EN,
    ID: Language.ID,
  };

  private static readonly PRISMA_TO_SUPPORTED: Partial<
    Record<Language, SupportedLanguage>
  > = {
    [Language.EN]: 'EN',
    [Language.ID]: 'ID',
  };

  /**
   * Convert SupportedLanguage to Prisma Language enum
   */
  static toPrismaLanguage(supportedLang: SupportedLanguage): Language {
    return this.SUPPORTED_TO_PRISMA[supportedLang] || Language.EN;
  }

  /**
   * Convert Prisma Language enum to SupportedLanguage
   */
  static fromPrismaLanguage(prismaLang: Language): SupportedLanguage {
    return this.PRISMA_TO_SUPPORTED[prismaLang] || 'EN';
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
