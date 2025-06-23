// src/users/services/user-bulk.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../../i18n/constants/languages';

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

    // Validate data
    const validTranslations = translations.filter(
      (t) => t.profileId && t.language && t.firstName && t.lastName,
    );

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
            deletedAt: null,
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
            deletedAt: { not: null },
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
