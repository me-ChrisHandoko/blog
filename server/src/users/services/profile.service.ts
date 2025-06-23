// src/users/services/profile.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import { CreateUserWithProfileDto } from '../dto/create-user.dto';
import { UpdateProfileTranslationDto } from '../dto/profile-translation.dto';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../../i18n/constants/languages';
import { UserWithProfile, CleanTranslation } from '../types/user.types';
import { UserMapper } from '../../shared/mappers/user.mapper';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ProfileService {
  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {}

  /**
   * Create user with multilingual profile
   */
  async createUserWithProfile(
    createUserDto: CreateUserWithProfileDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    // Validate email uniqueness
    const existingUser = await this.database.user.findUnique({
      where: { email: createUserDto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException(
        this.languageService.translate('users.messages.emailExists', lang),
      );
    }

    // Validate profile translations
    if (!createUserDto.profileTranslations?.length) {
      throw new BadRequestException(
        this.languageService.translate(
          'users.messages.profileTranslationRequired',
          lang,
        ),
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    // Create user with profile in transaction
    const result = await this.database.monitoredTransaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: createUserDto.email.toLowerCase(),
          password: hashedPassword,
          preferredLanguage: createUserDto.preferredLanguage || 'EN',
        },
      });

      // Create profile
      const profile = await tx.profile.create({
        data: {
          userId: user.id,
          avatar: createUserDto.avatar,
          phone: createUserDto.phone,
          address: createUserDto.address,
          birthday: createUserDto.birthday
            ? new Date(createUserDto.birthday)
            : null,
        },
      });

      // Create profile translations
      const translations = await Promise.all(
        createUserDto.profileTranslations.map((translation) =>
          tx.profileTranslation.create({
            data: {
              profileId: profile.id,
              language: translation.language,
              firstName: translation.firstName,
              lastName: translation.lastName,
              bio: translation.bio,
            },
          }),
        ),
      );

      return { user, profile, translations };
    }, 'create-user-with-profile');

    // Format response
    const safeUser = UserMapper.toSafeUser(result.user);
    const profileWithTranslations = {
      ...result.profile,
      translations: result.translations,
    };

    return {
      ...safeUser,
      profile: UserMapper.toCleanProfile(profileWithTranslations),
    };
  }

  /**
   * Get user with profile and translations
   */
  async getUserWithProfile(
    userId: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    const user = await this.database.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        profile: {
          include: {
            translations: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    if (!user.profile) {
      // Return user without profile
      return UserMapper.toSafeUser(user);
    }

    return UserMapper.toUserWithProfile(user, user.profile);
  }

  /**
   * Update profile translation for specific language
   */
  async updateProfileTranslation(
    userId: string,
    language: SupportedLanguage,
    updateDto: UpdateProfileTranslationDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    // Check if user exists
    const user = await this.database.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    if (!user.profile) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.profileNotFound', lang),
      );
    }

    // Update or create translation
    await this.database.profileTranslation.upsert({
      where: {
        profileId_language: {
          profileId: user.profile.id,
          language: language,
        },
      },
      update: {
        firstName: updateDto.firstName,
        lastName: updateDto.lastName,
        bio: updateDto.bio,
      },
      create: {
        profileId: user.profile.id,
        language: language,
        firstName: updateDto.firstName || '',
        lastName: updateDto.lastName || '',
        bio: updateDto.bio,
      },
    });

    // Return updated user with profile
    return await this.getUserWithProfile(userId, lang);
  }

  /**
   * Delete profile translation for specific language
   */
  async deleteProfileTranslation(
    userId: string,
    language: SupportedLanguage,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<void> {
    const user = await this.database.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        profile: {
          include: {
            translations: true,
          },
        },
      },
    });

    if (!user || !user.profile) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.profileNotFound', lang),
      );
    }

    // Don't allow deletion if this is the only translation
    if (user.profile.translations.length <= 1) {
      throw new BadRequestException(
        this.languageService.translate(
          'users.messages.profileTranslationRequired',
          lang,
        ),
      );
    }

    // Delete the translation
    await this.database.profileTranslation.delete({
      where: {
        profileId_language: {
          profileId: user.profile.id,
          language: language,
        },
      },
    });
  }

  /**
   * Update profile basic info (non-translatable fields)
   */
  async updateProfileBasicInfo(
    userId: string,
    updateData: {
      avatar?: string;
      phone?: string;
      address?: string;
      birthday?: string;
    },
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    const user = await this.database.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    if (!user.profile) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.profileNotFound', lang),
      );
    }

    // Update profile
    await this.database.profile.update({
      where: { id: user.profile.id },
      data: {
        ...(updateData.avatar !== undefined && { avatar: updateData.avatar }),
        ...(updateData.phone !== undefined && { phone: updateData.phone }),
        ...(updateData.address !== undefined && {
          address: updateData.address,
        }),
        ...(updateData.birthday !== undefined && {
          birthday: updateData.birthday ? new Date(updateData.birthday) : null,
        }),
      },
    });

    return await this.getUserWithProfile(userId, lang);
  }
}
