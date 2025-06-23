// src/users/users.service.ts - FIXED TRANSLATION CALLS
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
// ✅ Use composition instead of inheritance to avoid compatibility issues
import { PrismaService } from '../database/prisma.service';
import { EnhancedPrismaService } from '../database/enhanced-prisma.service';
// ✅ FIXED: Import types from query optimizer
import {
  QueryOptimizerService,
  UserSearchResult,
  OffsetPaginatedResult,
  UserStats,
} from '../database/query-optimizer.service';
import { LanguageService } from '../i18n/services/language.service';
import { CreateUserDto, CreateUserWithProfileDto } from './dto/create-user.dto';
import { UpdateProfileTranslationDto } from './dto/profile-translation.dto';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../i18n/constants/languages';
import { User, Language } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// ✅ Import clean types and utilities
import {
  SafeUser,
  UserWithProfile,
  CleanTranslation,
  PaginatedResponse,
} from './types/user.types';
import { UserMapper } from '../shared/mappers/user.mapper';
import { LanguageConverter } from '../shared/utils/language-converter';

@Injectable()
export class UsersService {
  constructor(
    // ✅ COMPOSITION: Use both services without inheritance
    private readonly basePrisma: PrismaService, // For compatibility with existing code
    private readonly enhancedPrisma: EnhancedPrismaService, // For enhanced features
    private readonly queryOptimizer: QueryOptimizerService,
    private readonly languageService: LanguageService,
  ) {}

  /**
   * Helper method untuk format entity dengan translation
   */
  protected formatEntityWithTranslation<T extends object>(
    entity: T,
    translations: CleanTranslation[],
    lang: SupportedLanguage,
  ): T & { translation?: CleanTranslation } {
    const currentLang = LanguageConverter.toPrismaLanguage(lang);
    const translation = translations.find((t) => t.language === currentLang);

    return {
      ...entity,
      ...(translation && { translation }),
    };
  }

  /**
   * Helper method untuk konversi language dengan proper typing
   */
  private convertToLanguageEnum(supportedLang: SupportedLanguage): Language {
    return LanguageConverter.toPrismaLanguage(supportedLang);
  }

  /**
   * Create user basic tanpa profile
   */
  async create(
    createUserDto: CreateUserDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    // Validasi email belum digunakan
    const existingUser = await this.enhancedPrisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        this.languageService.translate('users.messages.emailExists', lang),
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    // Convert language dengan proper typing
    const preferredLanguage = createUserDto.preferredLanguage
      ? this.convertToLanguageEnum(createUserDto.preferredLanguage)
      : this.convertToLanguageEnum(getDefaultLanguage());

    try {
      // ✅ Use enhanced monitoring
      const user = await this.enhancedPrisma.monitoredQuery(async () => {
        return await this.enhancedPrisma.user.create({
          data: {
            email: createUserDto.email.toLowerCase().trim(),
            password: hashedPassword,
            preferredLanguage: preferredLanguage,
          },
        });
      }, 'create-user');

      return UserMapper.toSafeUser(user);
    } catch (error) {
      throw new BadRequestException(
        this.languageService.translate('common.messages.error', lang),
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
    const existingUser = await this.enhancedPrisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        this.languageService.translate('users.messages.emailExists', lang),
      );
    }

    // Validasi setidaknya ada satu translation
    if (
      !createUserDto.profileTranslations ||
      createUserDto.profileTranslations.length === 0
    ) {
      throw new BadRequestException(
        this.languageService.translate(
          'users.messages.profileTranslationRequired',
          lang,
        ),
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    // Convert language dengan proper typing
    const preferredLanguage = createUserDto.preferredLanguage
      ? this.convertToLanguageEnum(createUserDto.preferredLanguage)
      : this.convertToLanguageEnum(getDefaultLanguage());

    try {
      // ✅ Enhanced transaction dengan monitoring
      const result = await this.enhancedPrisma.monitoredQuery(async () => {
        return await this.enhancedPrisma.$transaction(async (tx) => {
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
          const translationData = createUserDto.profileTranslations.map(
            (translation) => ({
              profileId: profile.id,
              language: this.convertToLanguageEnum(translation.language),
              firstName: translation.firstName,
              lastName: translation.lastName,
              bio: translation.bio,
            }),
          );

          const translations = await Promise.all(
            translationData.map(async (data) =>
              tx.profileTranslation.create({ data }),
            ),
          );

          return { user, profile, translations };
        });
      }, 'create-user-with-profile');

      // Format response dengan proper type conversion
      const safeUser = UserMapper.toSafeUser(result.user);
      const cleanProfile = UserMapper.toCleanProfile({
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
        this.languageService.translate('common.messages.error', lang),
      );
    }
  }

  /**
   * ✅ OPTIMIZED: Find user by ID dengan enhanced query
   */
  async findOne(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    const user = await this.enhancedPrisma.monitoredQuery(async () => {
      return await this.enhancedPrisma.user.findUnique({
        where: { id },
        include: {
          profile: {
            include: {
              translations: true,
            },
          },
        },
      });
    }, 'find-user-by-id');

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    // Create safe user
    const safeUser = UserMapper.toSafeUser(user);

    // Format dengan translation yang sesuai
    if (user.profile) {
      const cleanProfile = UserMapper.toCleanProfile(user.profile);
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
   * ✅ OPTIMIZED: Get all users dengan query optimizer
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<PaginatedResponse<UserWithProfile>> {
    const currentLanguage = LanguageConverter.toPrismaLanguage(lang);

    // ✅ Use query optimizer untuk better performance
    const result = await this.queryOptimizer.findUsersWithOffsetPagination({
      page,
      limit,
      lang: currentLanguage,
    });

    // Format response
    const formattedUsers: UserWithProfile[] = result.data.map((user: any) => {
      const safeUser = UserMapper.toSafeUser(user);

      if (user.profile) {
        const translation = user.profile.translations[0];
        return {
          ...safeUser,
          profile: {
            id: user.profile.id,
            avatar: user.profile.avatar,
            phone: user.profile.phone,
            address: user.profile.address,
            birthday: user.profile.birthday,
            userId: user.profile.userId,
            translations: translation ? [translation] : [],
          },
          translation: translation || undefined,
        };
      }

      return safeUser;
    });

    return {
      data: formattedUsers,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      },
    };
  }

  /**
   * ✅ OPTIMIZED: User search dengan query optimizer - FIXED RETURN TYPE
   */
  async searchUsers({
    query,
    page = 1,
    limit = 10,
    lang = getDefaultLanguage(),
  }: {
    query: string;
    page?: number;
    limit?: number;
    lang?: SupportedLanguage;
  }): Promise<UserSearchResult> {
    const currentLanguage = LanguageConverter.toPrismaLanguage(lang);

    return await this.queryOptimizer.searchUsersOptimized({
      query,
      page,
      limit,
      lang: currentLanguage,
    });
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
    const user = await this.enhancedPrisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.profileNotFound', lang),
      );
    }

    const prismaLanguage = this.convertToLanguageEnum(language);

    try {
      // ✅ Enhanced upsert dengan monitoring
      await this.enhancedPrisma.monitoredQuery(async () => {
        return await this.enhancedPrisma.profileTranslation.upsert({
          where: {
            profileId_language: {
              profileId: user.profile!.id,
              language: prismaLanguage,
            },
          },
          update: {
            firstName: updateDto.firstName,
            lastName: updateDto.lastName,
            bio: updateDto.bio,
          },
          create: {
            profileId: user.profile!.id,
            language: prismaLanguage,
            firstName: updateDto.firstName!,
            lastName: updateDto.lastName!,
            bio: updateDto.bio,
          },
        });
      }, 'update-profile-translation');

      return this.findOne(userId, lang);
    } catch (error) {
      throw new BadRequestException(
        this.languageService.translate('common.messages.error', lang),
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
    const user = await this.enhancedPrisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    // ✅ Enhanced soft delete dengan monitoring
    await this.enhancedPrisma.monitoredQuery(async () => {
      return await this.enhancedPrisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }, 'soft-delete-user');
  }

  /**
   * ✅ OPTIMIZED: Get user statistics dengan caching
   */
  async getUserStats(
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserStats> {
    return await this.queryOptimizer.getUserStatsCached();
  }

  /**
   * ✅ NEW: Get user activity analytics
   */
  async getUserActivityAnalytics(): Promise<{
    recentlyActive: number;
    totalActive: number;
    newUsersThisMonth: number;
    topLanguages: Array<{ language: string; count: number }>;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // ✅ Enhanced analytics dengan monitoring
    return await this.enhancedPrisma.monitoredQuery(async () => {
      const [recentlyActive, totalActive, newUsersThisMonth, languageStats] =
        await Promise.all([
          this.enhancedPrisma.user.count({
            where: {
              lastLoginAt: { gte: thirtyDaysAgo },
              deletedAt: null,
            },
          }),
          this.enhancedPrisma.user.count({
            where: {
              isActive: true,
              deletedAt: null,
            },
          }),
          this.enhancedPrisma.user.count({
            where: {
              createdAt: { gte: oneMonthAgo },
              deletedAt: null,
            },
          }),
          this.enhancedPrisma.user.groupBy({
            by: ['preferredLanguage'],
            where: { deletedAt: null },
            _count: true,
            orderBy: { _count: { preferredLanguage: 'desc' } },
            take: 5,
          }),
        ]);

      const topLanguages = languageStats.map((stat) => ({
        language: stat.preferredLanguage,
        count: stat._count,
      }));

      return {
        recentlyActive,
        totalActive,
        newUsersThisMonth,
        topLanguages,
      };
    }, 'user-activity-analytics');
  }

  /**
   * ✅ NEW: Get performance metrics for users service
   */
  async getPerformanceMetrics(): Promise<{
    queryStats: any;
    databaseHealth: any;
    recommendations: string[];
  }> {
    const [queryStats, health] = await Promise.all([
      this.enhancedPrisma.getQueryStats(),
      this.enhancedPrisma.healthCheck(),
    ]);

    const recommendations: string[] = [];

    if (queryStats.averageQueryTime > 500) {
      recommendations.push('Consider adding database indices for user queries');
    }

    if (parseFloat(queryStats.slowQueryRatio) > 10) {
      recommendations.push(
        'High slow query ratio detected - review user service queries',
      );
    }

    if (!health.healthy) {
      recommendations.push('Database connectivity issues detected');
    }

    if (recommendations.length === 0) {
      recommendations.push('User service performance is optimal');
    }

    return {
      queryStats,
      databaseHealth: health,
      recommendations,
    };
  }

  /**
   * ✅ NEW: Enhanced user statistics dengan role breakdown
   */
  async getEnhancedUserStats(): Promise<
    UserStats & {
      roleBreakdown: Array<{ role: string; count: number }>;
      languageBreakdown: Array<{ language: string; count: number }>;
      verificationStats: {
        verified: number;
        unverified: number;
        verificationRate: string;
      };
      activityStats: {
        active: number;
        inactive: number;
        recentlyActive: number;
        activityRate: string;
      };
    }
  > {
    const basicStats = await this.getUserStats();

    // ✅ Get additional statistics dengan monitoring
    const additionalStats = await this.enhancedPrisma.monitoredQuery(
      async () => {
        const [roleStats, languageStats] = await Promise.all([
          this.enhancedPrisma.user.groupBy({
            by: ['role'],
            where: { deletedAt: null },
            _count: true,
            orderBy: { _count: { role: 'desc' } },
          }),
          this.enhancedPrisma.user.groupBy({
            by: ['preferredLanguage'],
            where: { deletedAt: null },
            _count: true,
            orderBy: { _count: { preferredLanguage: 'desc' } },
          }),
        ]);

        return { roleStats, languageStats };
      },
      'enhanced-user-statistics',
    );

    const roleBreakdown = additionalStats.roleStats.map((stat) => ({
      role: stat.role,
      count: stat._count,
    }));

    const languageBreakdown = additionalStats.languageStats.map((stat) => ({
      language: stat.preferredLanguage,
      count: stat._count,
    }));

    const verificationRate =
      basicStats.total > 0
        ? ((basicStats.verified / basicStats.total) * 100).toFixed(2) + '%'
        : '0%';

    const activityRate =
      basicStats.total > 0
        ? ((basicStats.active / basicStats.total) * 100).toFixed(2) + '%'
        : '0%';

    return {
      ...basicStats,
      roleBreakdown,
      languageBreakdown,
      verificationStats: {
        verified: basicStats.verified,
        unverified: basicStats.unverified,
        verificationRate,
      },
      activityStats: {
        active: basicStats.active,
        inactive: basicStats.inactive,
        recentlyActive: basicStats.recentlyActive,
        activityRate,
      },
    };
  }

  /**
   * ✅ NEW: Find users by role dengan pagination
   */
  async findUsersByRole(
    role: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN',
    page: number = 1,
    limit: number = 10,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<PaginatedResponse<SafeUser>> {
    const result = await this.queryOptimizer.findUsersWithOffsetPagination({
      page,
      limit,
      lang: LanguageConverter.toPrismaLanguage(lang),
      filters: {
        role: role,
      },
    });

    const safeUsers: SafeUser[] = result.data.map((user: any) =>
      UserMapper.toSafeUser(user),
    );

    return {
      data: safeUsers,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      },
    };
  }

  /**
   * ✅ NEW: Bulk operations untuk multiple users - FIXED TYPE HANDLING
   */
  async bulkUpdateUsers(
    updates: Array<{
      userId: string;
      data: {
        isActive?: boolean;
        isVerified?: boolean;
        role?: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
      };
    }>,
  ): Promise<{
    updated: number;
    failed: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    // ✅ Process in chunks untuk better performance
    const chunkSize = 10;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);

      const promises = chunk.map(async (update) => {
        try {
          // ✅ FIXED: Proper type conversion for role
          const updateData: any = {
            ...(update.data.isActive !== undefined && {
              isActive: update.data.isActive,
            }),
            ...(update.data.isVerified !== undefined && {
              isVerified: update.data.isVerified,
            }),
          };

          // ✅ Convert string role to Role enum if provided
          if (update.data.role) {
            updateData.role = update.data.role as any; // Prisma will validate enum
          }

          await this.enhancedPrisma.monitoredQuery(async () => {
            return await this.enhancedPrisma.user.update({
              where: { id: update.userId },
              data: updateData,
            });
          }, 'bulk-update-user');
          results.updated++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            userId: update.userId,
            error: error.message,
          });
        }
      });

      await Promise.allSettled(promises);
    }

    return results;
  }
}
