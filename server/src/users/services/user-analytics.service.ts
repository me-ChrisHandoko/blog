// src/users/services/user-analytics.service.ts - ANALYTICS & STATISTICS
import { Injectable } from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../../i18n/constants/languages';
import { UserStats } from '../types/user.types';

export interface UserActivityAnalytics {
  recentlyActive: number;
  totalActive: number;
  newUsersThisMonth: number;
  topLanguages: Array<{ language: string; count: number }>;
}

export interface EnhancedUserStats extends UserStats {
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

@Injectable()
export class UserAnalyticsService {
  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {}

  /**
   * Get basic user statistics
   */
  async getUserStats(): Promise<UserStats> {
    return await this.database.cachedQuery(
      'user_stats_basic',
      async () => {
        const [total, active, verified, recentlyActive] = await Promise.all([
          this.database.user.count({
            where: { deletedAt: null },
          }),
          this.database.user.count({
            where: { deletedAt: null, isActive: true },
          }),
          this.database.user.count({
            where: { deletedAt: null, isVerified: true },
          }),
          this.database.user.count({
            where: {
              deletedAt: null,
              lastLoginAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
              },
            },
          }),
        ]);

        return {
          total,
          active,
          verified,
          inactive: total - active,
          unverified: total - verified,
          recentlyActive,
        };
      },
      300, // Cache for 5 minutes
    );
  }

  /**
   * Get enhanced user statistics with detailed breakdowns
   */
  async getEnhancedUserStats(): Promise<EnhancedUserStats> {
    return await this.database.cachedQuery(
      'user_stats_enhanced',
      async () => {
        const basicStats = await this.getUserStats();

        const [roleStats, languageStats] = await Promise.all([
          this.database.user.groupBy({
            by: ['role'],
            where: { deletedAt: null },
            _count: true,
            orderBy: { _count: { role: 'desc' } },
          }),
          this.database.user.groupBy({
            by: ['preferredLanguage'],
            where: { deletedAt: null },
            _count: true,
            orderBy: { _count: { preferredLanguage: 'desc' } },
          }),
        ]);

        const roleBreakdown = roleStats.map((stat) => ({
          role: stat.role,
          count: stat._count,
        }));

        const languageBreakdown = languageStats.map((stat) => ({
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
      },
      300, // Cache for 5 minutes
    );
  }

  /**
   * Get user activity analytics
   */
  async getUserActivityAnalytics(): Promise<UserActivityAnalytics> {
    return await this.database.cachedQuery(
      'user_activity_analytics',
      async () => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const [recentlyActive, totalActive, newUsersThisMonth, languageStats] =
          await Promise.all([
            this.database.user.count({
              where: {
                lastLoginAt: { gte: thirtyDaysAgo },
                deletedAt: null,
              },
            }),
            this.database.user.count({
              where: {
                isActive: true,
                deletedAt: null,
              },
            }),
            this.database.user.count({
              where: {
                createdAt: { gte: oneMonthAgo },
                deletedAt: null,
              },
            }),
            this.database.user.groupBy({
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
      },
      600, // Cache for 10 minutes
    );
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
    return await this.database.cachedQuery(
      `user_growth_${months}`,
      async () => {
        const results: Array<{
          month: string;
          newUsers: number;
          totalUsers: number;
          activeUsers: number;
        }> = [];
        const today = new Date();

        for (let i = months - 1; i >= 0; i--) {
          const monthStart = new Date(
            today.getFullYear(),
            today.getMonth() - i,
            1,
          );
          const monthEnd = new Date(
            today.getFullYear(),
            today.getMonth() - i + 1,
            0,
          );
          const monthKey = monthStart.toISOString().substring(0, 7); // YYYY-MM

          const [newUsers, totalUsers, activeUsers] = await Promise.all([
            this.database.user.count({
              where: {
                createdAt: {
                  gte: monthStart,
                  lte: monthEnd,
                },
                deletedAt: null,
              },
            }),
            this.database.user.count({
              where: {
                createdAt: { lte: monthEnd },
                deletedAt: null,
              },
            }),
            this.database.user.count({
              where: {
                createdAt: { lte: monthEnd },
                lastLoginAt: {
                  gte: new Date(monthEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
                },
                deletedAt: null,
              },
            }),
          ]);

          results.push({
            month: monthKey,
            newUsers,
            totalUsers,
            activeUsers,
          });
        }

        return results;
      },
      1800, // Cache for 30 minutes
    );
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
    return await this.database.cachedQuery(
      'user_retention_analytics',
      async () => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Simple retention calculation
        const [day1Users, day7Users, day30Users] = await Promise.all([
          this.database.user.count({
            where: {
              createdAt: { lte: oneDayAgo },
              lastLoginAt: { gte: oneDayAgo },
              deletedAt: null,
            },
          }),
          this.database.user.count({
            where: {
              createdAt: { lte: sevenDaysAgo },
              lastLoginAt: { gte: sevenDaysAgo },
              deletedAt: null,
            },
          }),
          this.database.user.count({
            where: {
              createdAt: { lte: thirtyDaysAgo },
              lastLoginAt: { gte: thirtyDaysAgo },
              deletedAt: null,
            },
          }),
        ]);

        const [totalDay1, totalDay7, totalDay30] = await Promise.all([
          this.database.user.count({
            where: { createdAt: { lte: oneDayAgo }, deletedAt: null },
          }),
          this.database.user.count({
            where: { createdAt: { lte: sevenDaysAgo }, deletedAt: null },
          }),
          this.database.user.count({
            where: { createdAt: { lte: thirtyDaysAgo }, deletedAt: null },
          }),
        ]);

        const day1 = totalDay1 > 0 ? (day1Users / totalDay1) * 100 : 0;
        const day7 = totalDay7 > 0 ? (day7Users / totalDay7) * 100 : 0;
        const day30 = totalDay30 > 0 ? (day30Users / totalDay30) * 100 : 0;

        // Simple cohort analysis for last 6 months
        const cohortAnalysis: Array<{
          cohort: string;
          day1Retention: number;
          day7Retention: number;
          day30Retention: number;
        }> = [];

        for (let i = 5; i >= 0; i--) {
          const cohortStart = new Date();
          cohortStart.setMonth(cohortStart.getMonth() - i);
          cohortStart.setDate(1);

          const cohortKey = cohortStart.toISOString().substring(0, 7);

          // This is a simplified cohort analysis
          // In production, you'd want more sophisticated cohort tracking
          cohortAnalysis.push({
            cohort: cohortKey,
            day1Retention: Math.round(day1 * 100) / 100,
            day7Retention: Math.round(day7 * 100) / 100,
            day30Retention: Math.round(day30 * 100) / 100,
          });
        }

        return {
          day1: Math.round(day1 * 100) / 100,
          day7: Math.round(day7 * 100) / 100,
          day30: Math.round(day30 * 100) / 100,
          cohortAnalysis,
        };
      },
      3600, // Cache for 1 hour
    );
  }

  /**
   * Clear analytics cache
   */
  clearAnalyticsCache(): void {
    const cacheKeys = [
      'user_stats_basic',
      'user_stats_enhanced',
      'user_activity_analytics',
      'user_retention_analytics',
    ];

    // Clear growth analytics cache for different month ranges
    for (let i = 1; i <= 24; i++) {
      cacheKeys.push(`user_growth_${i}`);
    }

    // Note: This would need to be implemented in the database service
    // this.database.clearCacheKeys(cacheKeys);
    this.database.clearQueryCache();
  }
}
