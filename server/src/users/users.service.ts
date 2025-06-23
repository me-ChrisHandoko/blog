// src/users/users.service.ts - CLEAN FACADE PATTERN
import { Injectable } from '@nestjs/common';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../i18n/constants/languages';

// Import specialized services
import { UserService } from './services/user.service';
import { ProfileService } from './services/profile.service';
import {
  UserAnalyticsService,
  UserActivityAnalytics,
  EnhancedUserStats,
} from './services/user-analytics.service';
import {
  UserQueryService,
  UserSearchFilters,
  UserSearchOptions,
} from './services/user-query.service';

// Import DTOs and types
import { CreateUserDto, CreateUserWithProfileDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileTranslationDto } from './dto/profile-translation.dto';
import {
  SafeUser,
  UserWithProfile,
  UserStats,
  PaginatedResponse,
} from './types/user.types';

/**
 * Main Users Service - Facade Pattern
 *
 * This service acts as a single entry point for all user operations,
 * delegating to specialized services for specific functionality.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly userService: UserService,
    private readonly profileService: ProfileService,
    private readonly analyticsService: UserAnalyticsService,
    private readonly queryService: UserQueryService,
  ) {}

  // ==========================================
  // BASIC USER OPERATIONS (Delegate to UserService)
  // ==========================================

  /**
   * Create a basic user without profile
   */
  async create(
    createUserDto: CreateUserDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    return await this.userService.create(createUserDto, lang);
  }

  /**
   * Find user by ID
   */
  async findOne(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    // Try to get user with profile first
    try {
      return await this.profileService.getUserWithProfile(id, lang);
    } catch (error) {
      // Fallback to basic user if profile not found
      const user = await this.userService.findById(id, lang);
      return user as UserWithProfile;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(
    email: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    return await this.userService.findByEmail(email, lang);
  }

  /**
   * Update user basic information
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    return await this.userService.update(id, updateUserDto, lang);
  }

  /**
   * Soft delete user
   */
  async remove(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<void> {
    return await this.userService.softDelete(id, lang);
  }

  /**
   * Restore soft deleted user
   */
  async restore(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    return await this.userService.restore(id, lang);
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    return await this.userService.updateLastLogin(id);
  }

  /**
   * Check if user exists
   */
  async exists(id: string): Promise<boolean> {
    return await this.userService.exists(id);
  }

  // ==========================================
  // PROFILE OPERATIONS (Delegate to ProfileService)
  // ==========================================

  /**
   * Create user with multilingual profile
   */
  async createWithProfile(
    createUserDto: CreateUserWithProfileDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    return await this.profileService.createUserWithProfile(createUserDto, lang);
  }

  /**
   * Get user with profile and translations
   */
  async getUserWithProfile(
    userId: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    return await this.profileService.getUserWithProfile(userId, lang);
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
    return await this.profileService.updateProfileTranslation(
      userId,
      language,
      updateDto,
      lang,
    );
  }

  /**
   * Delete profile translation for specific language
   */
  async deleteProfileTranslation(
    userId: string,
    language: SupportedLanguage,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<void> {
    return await this.profileService.deleteProfileTranslation(
      userId,
      language,
      lang,
    );
  }

  // ==========================================
  // QUERY & SEARCH OPERATIONS (Delegate to QueryService)
  // ==========================================

  /**
   * Get paginated list of all users
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<PaginatedResponse<UserWithProfile>> {
    return (await this.queryService.findUsers({
      page,
      limit,
      options: { includeProfile: true },
      lang,
    })) as PaginatedResponse<UserWithProfile>;
  }

  /**
   * Get paginated list of users with advanced filtering
   */
  async findUsers({
    page = 1,
    limit = 10,
    filters = {},
    options = {},
    lang = getDefaultLanguage(),
  }: {
    page?: number;
    limit?: number;
    filters?: UserSearchFilters;
    options?: UserSearchOptions;
    lang?: SupportedLanguage;
  }): Promise<PaginatedResponse<UserWithProfile | SafeUser>> {
    return await this.queryService.findUsers({
      page,
      limit,
      filters,
      options,
      lang,
    });
  }

  /**
   * Search users by text query
   */
  async searchUsers({
    query,
    page = 1,
    limit = 10,
    filters = {},
    options = { includeProfile: true },
    lang = getDefaultLanguage(),
  }: {
    query: string;
    page?: number;
    limit?: number;
    filters?: UserSearchFilters;
    options?: UserSearchOptions;
    lang?: SupportedLanguage;
  }): Promise<PaginatedResponse<UserWithProfile | SafeUser>> {
    return await this.queryService.searchUsers({
      query,
      page,
      limit,
      filters,
      options,
      lang,
    });
  }

  /**
   * Get users by role with pagination
   */
  async findUsersByRole(
    role: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN',
    page: number = 1,
    limit: number = 10,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<PaginatedResponse<SafeUser>> {
    return await this.queryService.findUsersByRole(role, page, limit, lang);
  }

  // ==========================================
  // ANALYTICS & STATISTICS (Delegate to AnalyticsService)
  // ==========================================

  /**
   * Get basic user statistics
   */
  async getUserStats(
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserStats> {
    return await this.analyticsService.getUserStats();
  }

  /**
   * Get enhanced user statistics with detailed breakdowns
   */
  async getEnhancedUserStats(): Promise<EnhancedUserStats> {
    return await this.analyticsService.getEnhancedUserStats();
  }

  /**
   * Get user activity analytics
   */
  async getUserActivityAnalytics(): Promise<UserActivityAnalytics> {
    return await this.analyticsService.getUserActivityAnalytics();
  }

  /**
   * Get user growth analytics (by month)
   */
  async getUserGrowthAnalytics(months: number = 12): Promise<
    Array<{
      month: string;
      newUsers: number;
      totalUsers: number;
      activeUsers: number;
    }>
  > {
    return await this.analyticsService.getUserGrowthAnalytics(months);
  }

  /**
   * Get user retention analytics
   */
  async getUserRetentionAnalytics(): Promise<{
    day1: number;
    day7: number;
    day30: number;
    cohortAnalysis: Array<{
      cohort: string;
      day1Retention: number;
      day7Retention: number;
      day30Retention: number;
    }>;
  }> {
    return await this.analyticsService.getUserRetentionAnalytics();
  }

  /**
   * Clear analytics cache
   */
  clearAnalyticsCache(): void {
    this.analyticsService.clearAnalyticsCache();
  }

  // ==========================================
  // BULK OPERATIONS
  // ==========================================

  /**
   * Bulk update multiple users
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

    // Process in smaller chunks for better performance
    const chunkSize = 10;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);

      const promises = chunk.map(async (update) => {
        try {
          await this.userService.update(update.userId, update.data);
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

  /**
   * Get total user count
   */
  async count(includeDeleted: boolean = false): Promise<number> {
    return await this.userService.count(includeDeleted);
  }

  // ==========================================
  // SERVICE HEALTH & DIAGNOSTICS
  // ==========================================

  /**
   * Get service performance metrics
   */
  async getServiceMetrics(): Promise<{
    userOperations: any;
    profileOperations: any;
    queryOperations: any;
    analyticsOperations: any;
    recommendations: string[];
  }> {
    // This would typically gather metrics from each service
    // For now, we'll return a basic structure
    const recommendations: string[] = [];

    // Add performance recommendations based on service usage
    recommendations.push(
      'Consider implementing Redis caching for frequently accessed user data',
    );
    recommendations.push(
      'Monitor slow query performance in user search operations',
    );
    recommendations.push(
      'Implement user data archiving for old inactive accounts',
    );

    return {
      userOperations: {
        totalOperations: 'tracked_by_monitoring',
        averageResponseTime: 'tracked_by_monitoring',
      },
      profileOperations: {
        totalOperations: 'tracked_by_monitoring',
        averageResponseTime: 'tracked_by_monitoring',
      },
      queryOperations: {
        totalOperations: 'tracked_by_monitoring',
        averageResponseTime: 'tracked_by_monitoring',
      },
      analyticsOperations: {
        totalOperations: 'tracked_by_monitoring',
        averageResponseTime: 'tracked_by_monitoring',
      },
      recommendations,
    };
  }

  /**
   * Validate service health
   */
  async validateServiceHealth(): Promise<{
    healthy: boolean;
    services: {
      userService: boolean;
      profileService: boolean;
      queryService: boolean;
      analyticsService: boolean;
    };
    issues: string[];
  }> {
    const issues: string[] = [];
    const services = {
      userService: true,
      profileService: true,
      queryService: true,
      analyticsService: true,
    };

    try {
      // Test basic user operations
      await this.userService.count();
    } catch (error) {
      services.userService = false;
      issues.push('UserService: Database connection issues');
    }

    try {
      // Test analytics operations
      await this.analyticsService.getUserStats();
    } catch (error) {
      services.analyticsService = false;
      issues.push('AnalyticsService: Cache or database issues');
    }

    const healthy = Object.values(services).every((service) => service);

    return {
      healthy,
      services,
      issues: issues.length > 0 ? issues : ['All services operational'],
    };
  }
}

// src/users/services/user-bulk.service.ts - BULK OPERATIONS SERVICE
import { Injectable, Logger } from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../../i18n/constants/languages';
import { UpdateProfileTranslationDto } from '../dto/profile-translation.dto';
import { LanguageConverter } from '../../shared/utils/language-converter';

export interface BulkOperationResult {
  successful: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

@Injectable()
export class UserBulkService {
  private readonly logger = new Logger(UserBulkService.name);

  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {}

  /**
   * Bulk create profile translations
   */
  async bulkCreateProfileTranslations(
    translations: Array<{
      profileId: string;
      language: SupportedLanguage;
      firstName: string;
      lastName: string;
      bio?: string;
    }>,
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    if (translations.length === 0) {
      return result;
    }

    // Validate and convert data
    const validTranslations = translations
      .filter((t) => t.profileId && t.language && t.firstName && t.lastName)
      .map((t) => ({
        ...t,
        language: LanguageConverter.toPrismaLanguage(t.language),
      }));

    if (validTranslations.length !== translations.length) {
      const invalidCount = translations.length - validTranslations.length;
      this.logger.warn(`Filtered out ${invalidCount} invalid translations`);
    }

    try {
      // Use enhanced bulk upsert
      await this.database.bulkUpsert('profileTranslation', validTranslations, [
        'profileId',
        'language',
      ]);

      result.successful = validTranslations.length;

      this.logger.log(
        `✅ Bulk created ${result.successful} profile translations`,
      );
    } catch (error) {
      this.logger.error('Bulk translation creation failed:', error);

      // Fallback to individual operations
      return await this.fallbackBulkCreateTranslations(validTranslations);
    }

    return result;
  }

  /**
   * Bulk update user statuses
   */
  async bulkUpdateUserStatuses(
    updates: Array<{
      userId: string;
      isActive?: boolean;
      isVerified?: boolean;
    }>,
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    const chunkSize = 20;

    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);

      const promises = chunk.map(async (update) => {
        try {
          await this.database.monitoredQuery(async () => {
            return await this.database.user.update({
              where: { id: update.userId },
              data: {
                ...(update.isActive !== undefined && {
                  isActive: update.isActive,
                }),
                ...(update.isVerified !== undefined && {
                  isVerified: update.isVerified,
                }),
              },
            });
          }, 'bulk-update-user-status');

          result.successful++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            id: update.userId,
            error: error.message,
          });
        }
      });

      await Promise.allSettled(promises);
    }

    this.logger.log(
      `✅ Bulk updated ${result.successful} users, ${result.failed} failed`,
    );

    return result;
  }

  /**
   * Bulk soft delete users
   */
  async bulkSoftDeleteUsers(userIds: string[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      const updateResult = await this.database.monitoredQuery(async () => {
        return await this.database.user.updateMany({
          where: {
            id: { in: userIds },
            deletedAt: null, // Only delete non-deleted users
          },
          data: {
            deletedAt: new Date(),
            isActive: false,
          },
        });
      }, 'bulk-soft-delete-users');

      result.successful = updateResult.count;

      this.logger.log(`✅ Bulk soft deleted ${result.successful} users`);
    } catch (error) {
      this.logger.error('Bulk soft delete failed:', error);
      result.failed = userIds.length;
      result.errors.push({
        id: 'bulk_operation',
        error: error.message,
      });
    }

    return result;
  }

  /**
   * Bulk restore users
   */
  async bulkRestoreUsers(userIds: string[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      const updateResult = await this.database.monitoredQuery(async () => {
        return await this.database.user.updateMany({
          where: {
            id: { in: userIds },
            deletedAt: { not: null }, // Only restore deleted users
          },
          data: {
            deletedAt: null,
            isActive: true,
          },
        });
      }, 'bulk-restore-users');

      result.successful = updateResult.count;

      this.logger.log(`✅ Bulk restored ${result.successful} users`);
    } catch (error) {
      this.logger.error('Bulk restore failed:', error);
      result.failed = userIds.length;
      result.errors.push({
        id: 'bulk_operation',
        error: error.message,
      });
    }

    return result;
  }

  /**
   * Export users data for backup/migration
   */
  async exportUsersData(
    userIds?: string[],
    includeProfiles: boolean = true,
  ): Promise<{
    users: any[];
    profiles: any[];
    translations: any[];
    exportedAt: string;
    totalRecords: number;
  }> {
    const whereClause = userIds ? { id: { in: userIds } } : {};

    const [users, profiles, translations] = await Promise.all([
      this.database.monitoredQuery(async () => {
        return await this.database.user.findMany({
          where: whereClause,
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            isVerified: true,
            preferredLanguage: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            lastLoginAt: true,
          },
        });
      }, 'export-users-data'),

      includeProfiles
        ? this.database.monitoredQuery(async () => {
            return await this.database.profile.findMany({
              where: userIds ? { userId: { in: userIds } } : {},
            });
          }, 'export-profiles-data')
        : [],

      includeProfiles
        ? this.database.monitoredQuery(async () => {
            return await this.database.profileTranslation.findMany({
              where: userIds
                ? {
                    profile: { userId: { in: userIds } },
                  }
                : {},
            });
          }, 'export-translations-data')
        : [],
    ]);

    const totalRecords =
      users.length + (profiles?.length || 0) + (translations?.length || 0);

    this.logger.log(
      `📊 Exported ${totalRecords} records for ${users.length} users`,
    );

    return {
      users,
      profiles: profiles || [],
      translations: translations || [],
      exportedAt: new Date().toISOString(),
      totalRecords,
    };
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Fallback method for bulk translation creation
   */
  private async fallbackBulkCreateTranslations(
    translations: any[],
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const translation of translations) {
      try {
        await this.database.monitoredQuery(async () => {
          return await this.database.profileTranslation.upsert({
            where: {
              profileId_language: {
                profileId: translation.profileId,
                language: translation.language,
              },
            },
            update: {
              firstName: translation.firstName,
              lastName: translation.lastName,
              bio: translation.bio,
            },
            create: translation,
          });
        }, 'fallback-create-translation');

        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: translation.profileId,
          error: error.message,
        });
      }
    }

    return result;
  }
}
