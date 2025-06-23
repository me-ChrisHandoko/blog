// src/users/services/user-validation.service.ts - CLEAN VALIDATION SERVICE ONLY
import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import { SupportedLanguage } from '../../i18n/constants/languages';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserValidationService {
  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {}

  /**
   * Validate email uniqueness
   */
  async validateEmailUnique(
    email: string,
    lang: SupportedLanguage,
    excludeUserId?: string,
  ): Promise<void> {
    const existingUser = await this.database.monitoredQuery(async () => {
      return await this.database.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
      });
    }, 'validate-email-unique');

    if (existingUser && existingUser.id !== excludeUserId) {
      throw new ConflictException(
        this.languageService.translate('users.messages.emailExists', lang),
      );
    }
  }

  /**
   * Hash password with bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password
   */
  async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }

    // Minimal 8 karakter
    if (password.length < 8) {
      return false;
    }

    // Harus mengandung: huruf besar, huruf kecil, angka, dan simbol
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[@$!%*?&]/.test(password);

    return hasLowercase && hasUppercase && hasNumbers && hasSymbols;
  }

  /**
   * Validate profile translations
   */
  validateProfileTranslations(
    translations: any[],
    lang: SupportedLanguage,
  ): void {
    if (!translations || translations.length === 0) {
      throw new BadRequestException(
        this.languageService.translate(
          'users.messages.profileTranslationRequired',
          lang,
        ),
      );
    }

    // Check for duplicate languages
    const languages = translations.map((t) => t.language);
    const uniqueLanguages = new Set(languages);

    if (languages.length !== uniqueLanguages.size) {
      throw new BadRequestException(
        this.languageService.translate(
          'users.messages.duplicateLanguages',
          lang,
        ),
      );
    }

    // Validate each translation
    for (const translation of translations) {
      if (!translation.firstName || !translation.lastName) {
        throw new BadRequestException(
          this.languageService.translate('validation.name.required', lang),
        );
      }

      if (translation.firstName.length < 2 || translation.lastName.length < 2) {
        throw new BadRequestException(
          this.languageService.translate('validation.name.tooShort', lang),
        );
      }
    }
  }

  /**
   * Validate user role permissions
   */
  validateRolePermissions(
    currentUserRole: string,
    targetRole: string,
    lang: SupportedLanguage,
  ): void {
    const roleHierarchy = {
      SUPER_ADMIN: 4,
      ADMIN: 3,
      MODERATOR: 2,
      USER: 1,
    };

    const currentLevel = roleHierarchy[currentUserRole] || 0;
    const targetLevel = roleHierarchy[targetRole] || 0;

    if (currentLevel <= targetLevel) {
      throw new BadRequestException(
        this.languageService.translate('auth.messages.forbidden', lang),
      );
    }
  }

  /**
   * Validate user data consistency
   */
  async validateUserDataConsistency(
    userId: string,
    lang: SupportedLanguage,
  ): Promise<{
    isConsistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const user = await this.database.user.findUnique({
        where: { id: userId },
        include: {
          profile: {
            include: {
              translations: true,
            },
          },
        },
      });

      if (!user) {
        issues.push('User not found');
        return { isConsistent: false, issues };
      }

      // Check if user has profile but no translations
      if (
        user.profile &&
        (!user.profile.translations || user.profile.translations.length === 0)
      ) {
        issues.push('Profile exists but has no translations');
      }

      // Check if email format is valid
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user.email)) {
        issues.push('Invalid email format');
      }

      // Check if preferred language has corresponding translation
      if (user.profile?.translations) {
        const hasPreferredLanguageTranslation = user.profile.translations.some(
          (t) => t.language === user.preferredLanguage,
        );
        if (!hasPreferredLanguageTranslation) {
          issues.push(
            'User preferred language has no corresponding profile translation',
          );
        }
      }

      return {
        isConsistent: issues.length === 0,
        issues,
      };
    } catch (error) {
      issues.push(`Validation error: ${error.message}`);
      return { isConsistent: false, issues };
    }
  }
}
