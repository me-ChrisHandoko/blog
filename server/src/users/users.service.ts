// src/users/users.service.ts - FINAL FIXED VERSION
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
import { User, Language } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// FIXED: Import clean types
import {
  SafeUser,
  UserWithProfile,
  CleanTranslation,
  ProfileWithTranslations,
  PrismaProfileWithTranslations,
  PrismaProfileTranslation,
  UserStats,
  PaginatedResponse,
  PaginationMeta,
} from './types/user.types';

@Injectable()
export class UsersService extends MultilingualBaseService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly languageService: LanguageService,
  ) {
    super(prisma, languageService);
  }

  /**
   * FIXED: Helper method untuk konversi language dengan proper typing
   */
  private convertToLanguageEnum(supportedLang: SupportedLanguage): Language {
    const langString = this.languageService.supportedToPrisma(supportedLang);
    return langString as Language;
  }

  /**
   * FIXED: Helper method untuk create SafeUser dari Prisma User
   */
  private createSafeUser(prismaUser: User): SafeUser {
    return {
      id: prismaUser.id,
      email: prismaUser.email,
      role: prismaUser.role,
      isActive: prismaUser.isActive,
      isVerified: prismaUser.isVerified,
      lastLoginAt: prismaUser.lastLoginAt,
      preferredLanguage: prismaUser.preferredLanguage,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      deletedAt: prismaUser.deletedAt,
    };
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

    // FIXED: Convert language dengan proper typing
    const preferredLanguage = createUserDto.preferredLanguage
      ? this.convertToLanguageEnum(createUserDto.preferredLanguage)
      : this.convertToLanguageEnum(getDefaultLanguage());

    try {
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email.toLowerCase().trim(),
          password: hashedPassword,
          preferredLanguage: preferredLanguage,
        },
      });

      return this.createSafeUser(user);
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

    // FIXED: Convert language dengan proper typing
    const preferredLanguage = createUserDto.preferredLanguage
      ? this.convertToLanguageEnum(createUserDto.preferredLanguage)
      : this.convertToLanguageEnum(getDefaultLanguage());

    try {
      // Transaction untuk atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Create user
        const user = await tx.user.create({
          data: {
            email: createUserDto.email.toLowerCase().trim(),
            password: hashedPassword,
            preferredLanguage: preferredLanguage,
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
            const prismaLanguage = this.convertToLanguageEnum(
              translation.language,
            );
            return tx.profileTranslation.create({
              data: {
                profileId: profile.id,
                language: prismaLanguage,
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
      const safeUser = this.createSafeUser(result.user);
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

    // Create safe user
    const safeUser = this.createSafeUser(user);

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
   * OPTIMIZED: Get all users dengan pagination dan language support
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<PaginatedResponse<UserWithProfile>> {
    const skip = (page - 1) * limit;
    const currentLanguage = this.convertToLanguageEnum(lang);

    // OPTIMIZED: Single transaction with specific language translation
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take: limit,
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isVerified: true,
          preferredLanguage: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          deletedAt: true,
          profile: {
            select: {
              id: true,
              avatar: true,
              phone: true,
              address: true,
              birthday: true,
              userId: true,
              translations: {
                where: {
                  language: currentLanguage,
                },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    // OPTIMIZED: Format users dengan single translation
    const formattedUsers: UserWithProfile[] = users.map((user) => {
      const safeUser: SafeUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        deletedAt: user.deletedAt,
      };

      if (user.profile) {
        const translation = user.profile.translations[0];

        const userWithProfile: UserWithProfile = {
          ...safeUser,
          profile: {
            id: user.profile.id,
            avatar: user.profile.avatar,
            phone: user.profile.phone,
            address: user.profile.address,
            birthday: user.profile.birthday,
            userId: user.profile.userId,
            translations: translation
              ? [
                  {
                    language: translation.language,
                    firstName: translation.firstName,
                    lastName: translation.lastName,
                    bio: translation.bio ?? undefined,
                  },
                ]
              : [],
          },
          translation: translation
            ? {
                language: translation.language,
                firstName: translation.firstName,
                lastName: translation.lastName,
                bio: translation.bio ?? undefined,
              }
            : undefined,
        };

        return userWithProfile;
      }

      return safeUser;
    });

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return {
      data: formattedUsers,
      meta,
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

    const prismaLanguage = this.convertToLanguageEnum(language);

    try {
      // Upsert translation
      await this.prisma.profileTranslation.upsert({
        where: {
          profileId_language: {
            profileId: user.profile.id,
            language: prismaLanguage,
          },
        },
        update: {
          firstName: updateDto.firstName,
          lastName: updateDto.lastName,
          bio: updateDto.bio,
        },
        create: {
          profileId: user.profile.id,
          language: prismaLanguage,
          firstName: updateDto.firstName!,
          lastName: updateDto.lastName!,
          bio: updateDto.bio,
        },
      });

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
   * Get user statistics - OPTIMIZED query
   */
  async getUserStats(
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserStats> {
    const [activeCount, verifiedCount, total] = await Promise.all([
      this.prisma.user.count({
        where: { isActive: true, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { isVerified: true, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { deletedAt: null },
      }),
    ]);

    return {
      total,
      active: activeCount,
      verified: verifiedCount,
      inactive: total - activeCount,
      unverified: total - verifiedCount,
    };
  }

  /**
   * Find users by language preference
   */
  async findByLanguagePreference(
    language: SupportedLanguage,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponse<SafeUser>> {
    const skip = (page - 1) * limit;
    const prismaLanguage = this.convertToLanguageEnum(language);

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: {
          preferredLanguage: prismaLanguage,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          isVerified: true,
          preferredLanguage: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          deletedAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({
        where: {
          preferredLanguage: prismaLanguage,
          deletedAt: null,
        },
      }),
    ]);

    const safeUsers: SafeUser[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      deletedAt: user.deletedAt,
    }));

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return {
      data: safeUsers,
      meta,
    };
  }

  /**
   * Helper methods
   */
  private getMessage(key: string, lang: SupportedLanguage): string {
    return this.languageService.translate(key, lang);
  }

  private cleanProfile(
    prismaProfile: PrismaProfileWithTranslations,
  ): ProfileWithTranslations {
    const cleanTranslations: CleanTranslation[] =
      prismaProfile.translations.map((translation) => ({
        language: translation.language,
        firstName: translation.firstName,
        lastName: translation.lastName,
        bio: translation.bio ?? undefined,
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
}
