// src/users/users.service.ts - Complete Implementation
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LanguageService } from '../i18n/services/language.service';
import { MultilingualBaseService } from '../common/services/multilingual-base.service';
import { CreateUserDto, CreateUserWithProfileDto } from './dto/create-user.dto';
import { UpdateProfileTranslationDto } from './dto/profile-translation.dto';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../i18n/constants/languages';
import { User, Profile, Language } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Type definitions untuk response - FIXED: Match Prisma types exactly
type SafeUser = Omit<User, 'password'>;

// Raw Prisma types from database
type PrismaProfileTranslation = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  language: Language;
  firstName: string;
  lastName: string;
  bio: string | null; // Prisma uses null, not undefined
  profileId: string;
};

type PrismaProfileWithTranslations = Profile & {
  translations: PrismaProfileTranslation[];
};

// Cleaned response types for API
type CleanTranslation = {
  language: Language;
  firstName: string;
  lastName: string;
  bio?: string; // Convert null to undefined for API consistency
};

type ProfileWithTranslations = Omit<Profile, 'createdAt' | 'updatedAt'> & {
  translations: CleanTranslation[];
};

type UserWithProfile = SafeUser & {
  profile?: ProfileWithTranslations;
  translation?: CleanTranslation;
};

@Injectable()
export class UsersService extends MultilingualBaseService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly languageService: LanguageService,
  ) {
    super(prisma, languageService);
  }

  /**
   * Create user basic tanpa profile
   */
  async create(
    createUserDto: CreateUserDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    // Validasi email belum digunakan
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        this.getMessage('users.messages.emailExists', lang),
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    // Convert language ke Prisma enum
    const preferredLanguage = createUserDto.preferredLanguage
      ? this.languageService.supportedToPrisma(createUserDto.preferredLanguage)
      : this.languageService.supportedToPrisma(getDefaultLanguage());

    try {
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email.toLowerCase().trim(),
          password: hashedPassword,
          preferredLanguage: preferredLanguage as Language,
        },
      });

      // Return safe user without password
      return this.cleanUser(user);
    } catch (error) {
      throw new BadRequestException(
        this.getMessage('common.messages.error', lang),
      );
    }
  }

  /**
   * Create user dengan multilingual profile
   */
  async createWithProfile(
    createUserDto: CreateUserWithProfileDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    // Validasi email belum digunakan
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        this.getMessage('users.messages.emailExists', lang),
      );
    }

    // Validasi setidaknya ada satu translation
    if (
      !createUserDto.profileTranslations ||
      createUserDto.profileTranslations.length === 0
    ) {
      throw new BadRequestException(
        this.getMessage('users.messages.profileTranslationRequired', lang),
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    // Convert language ke Prisma enum
    const preferredLanguage = createUserDto.preferredLanguage
      ? this.languageService.supportedToPrisma(createUserDto.preferredLanguage)
      : this.languageService.supportedToPrisma(getDefaultLanguage());

    try {
      // Transaction untuk atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Create user
        const user = await tx.user.create({
          data: {
            email: createUserDto.email.toLowerCase().trim(),
            password: hashedPassword,
            preferredLanguage: preferredLanguage as Language,
          },
        });

        // 2. Create profile
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

        // 3. Create profile translations
        const translations = await Promise.all(
          createUserDto.profileTranslations.map(async (translation) => {
            const prismaLanguage = this.languageService.supportedToPrisma(
              translation.language,
            );
            return tx.profileTranslation.create({
              data: {
                profileId: profile.id,
                language: prismaLanguage as Language,
                firstName: translation.firstName,
                lastName: translation.lastName,
                bio: translation.bio,
              },
            });
          }),
        );

        return { user, profile, translations };
      });

      // Format response dengan proper type conversion
      const safeUser = this.cleanUser(result.user);
      const cleanProfile = this.cleanProfile({
        ...result.profile,
        translations: result.translations,
      });

      const userWithProfile: UserWithProfile = {
        ...safeUser,
        profile: cleanProfile,
      };

      // Apply language-specific formatting
      return this.formatEntityWithTranslation(
        userWithProfile,
        cleanProfile.translations,
        lang,
      );
    } catch (error) {
      throw new BadRequestException(
        this.getMessage('common.messages.error', lang),
      );
    }
  }

  /**
   * Find user by ID dengan profile dan translation
   */
  async findOne(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
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
        this.getMessage('users.messages.notFound', lang),
      );
    }

    // Remove password dan clean up types
    const safeUser = this.cleanUser(user);

    // Format dengan translation yang sesuai
    if (user.profile) {
      const cleanProfile = this.cleanProfile(user.profile);
      const userWithProfile: UserWithProfile = {
        ...safeUser,
        profile: cleanProfile,
      };

      return this.formatEntityWithTranslation(
        userWithProfile,
        cleanProfile.translations,
        lang,
      );
    }

    return safeUser;
  }

  /**
   * Get all users dengan pagination dan language support
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<{
    data: UserWithProfile[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        include: {
          profile: {
            include: {
              translations: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    // Format users dengan translations
    const formattedUsers = users.map((user) => {
      const safeUser = this.cleanUser(user);

      if (user.profile) {
        const cleanProfile = this.cleanProfile(user.profile);
        const userWithProfile: UserWithProfile = {
          ...safeUser,
          profile: cleanProfile,
        };

        return this.formatEntityWithTranslation(
          userWithProfile,
          cleanProfile.translations,
          lang,
        );
      }

      return safeUser;
    });

    return {
      data: formattedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update profile translation untuk bahasa tertentu
   */
  async updateProfileTranslation(
    userId: string,
    language: SupportedLanguage,
    updateDto: UpdateProfileTranslationDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    // Cek user dan profile exist
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new NotFoundException(
        this.getMessage('users.messages.profileNotFound', lang),
      );
    }

    const prismaLanguage = this.languageService.supportedToPrisma(language);

    try {
      // Upsert translation (update jika ada, create jika tidak ada)
      await this.prisma.profileTranslation.upsert({
        where: {
          profileId_language: {
            profileId: user.profile.id,
            language: prismaLanguage as Language,
          },
        },
        update: {
          firstName: updateDto.firstName,
          lastName: updateDto.lastName,
          bio: updateDto.bio,
        },
        create: {
          profileId: user.profile.id,
          language: prismaLanguage as Language,
          firstName: updateDto.firstName!,
          lastName: updateDto.lastName!,
          bio: updateDto.bio,
        },
      });

      // Return updated user
      return this.findOne(userId, lang);
    } catch (error) {
      throw new BadRequestException(
        this.getMessage('common.messages.error', lang),
      );
    }
  }

  /**
   * Delete user (soft delete)
   */
  async remove(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(
        this.getMessage('users.messages.notFound', lang),
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Helper method untuk mendapatkan pesan translation
   */
  private getMessage(key: string, lang: SupportedLanguage): string {
    return this.languageService.translate(key, lang);
  }

  /**
   * Helper method untuk mengkonversi Prisma profile ke clean API format
   */
  private cleanProfile(
    prismaProfile: PrismaProfileWithTranslations,
  ): ProfileWithTranslations {
    const cleanTranslations: CleanTranslation[] =
      prismaProfile.translations.map((translation) => ({
        language: translation.language,
        firstName: translation.firstName,
        lastName: translation.lastName,
        bio: translation.bio ?? undefined, // Convert null to undefined
      }));

    return {
      id: prismaProfile.id,
      avatar: prismaProfile.avatar,
      phone: prismaProfile.phone,
      address: prismaProfile.address,
      birthday: prismaProfile.birthday,
      userId: prismaProfile.userId,
      translations: cleanTranslations,
    };
  }

  /**
   * Helper method untuk mengkonversi Prisma user ke safe format
   */
  private cleanUser(prismaUser: User): SafeUser {
    const { password, ...safeUser } = prismaUser;
    return safeUser;
  }

  /**
   * Get user statistics
   */
  async getUserStats(lang: SupportedLanguage = getDefaultLanguage()) {
    const [total, active, verified] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.user.count({ where: { isVerified: true, deletedAt: null } }),
    ]);

    return {
      total,
      active,
      verified,
      inactive: total - active,
      unverified: total - verified,
    };
  }
}
