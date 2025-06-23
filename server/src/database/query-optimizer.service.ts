// src/database/query-optimizer.service.ts - FIXED COMPLETE VERSION
import { Injectable, Logger } from '@nestjs/common';
import { EnhancedDatabaseService } from './enhanced-database.service';
import { SupportedLanguage } from '../i18n/constants/languages';

// ✅ EXPORTED INTERFACES - Now properly accessible
export interface QueryOptimizationConfig {
  enableCaching: boolean;
  defaultCacheTTL: number;
  enableBulkOperations: boolean;
  enableQueryHints: boolean;
  maxPageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  metadata: {
    requestedCount: number;
    returnedCount: number;
    hasNextPage: boolean;
  };
}

export interface UserSearchResult {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OffsetPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface UserStats {
  total: number;
  active: number;
  verified: number;
  inactive: number;
  unverified: number;
  recentlyActive: number;
}

@Injectable()
export class QueryOptimizerService {
  private readonly logger = new Logger(QueryOptimizerService.name);
  private config: QueryOptimizationConfig = {
    enableCaching: process.env.NODE_ENV === 'production',
    defaultCacheTTL: 300, // 5 minutes
    enableBulkOperations: true,
    enableQueryHints: true,
    maxPageSize: 100,
  };

  constructor(private prisma: EnhancedDatabaseService) {}

  /**
   * ✅ FIXED: Optimized user queries dengan proper Prisma syntax
   */
  async findUsersOptimized({
    page = 1,
    limit = 10,
    lang,
    filters = {},
  }: {
    page?: number;
    limit?: number;
    lang: string;
    filters?: any;
  }): Promise<PaginatedResult<any>> {
    // ✅ Validate dan sanitize parameters
    const sanitizedLimit = Math.min(
      Math.max(1, limit),
      this.config.maxPageSize,
    );
    const sanitizedPage = Math.max(1, page);

    // ✅ FIXED: Use proper Prisma pagination without custom useIndex
    return await this.prisma.paginateWithCursor(this.prisma.user, {
      take: sanitizedLimit,
      where: {
        deletedAt: null,
        ...filters,
      },
      include: {
        profile: {
          select: {
            id: true,
            avatar: true,
            phone: true,
            address: true,
            birthday: true,
            userId: true,
            translations: {
              where: { language: lang as any },
              take: 1,
              select: {
                language: true,
                firstName: true,
                lastName: true,
                bio: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ✅ FIXED: Offset-based pagination untuk compatibility
   */
  async findUsersWithOffsetPagination({
    page = 1,
    limit = 10,
    lang,
    filters = {},
    orderBy = { createdAt: 'desc' },
  }: {
    page?: number;
    limit?: number;
    lang: string;
    filters?: any;
    orderBy?: any;
  }): Promise<OffsetPaginatedResult<any>> {
    const sanitizedLimit = Math.min(
      Math.max(1, limit),
      this.config.maxPageSize,
    );
    const sanitizedPage = Math.max(1, page);
    const skip = (sanitizedPage - 1) * sanitizedLimit;

    // ✅ Execute queries in parallel untuk better performance
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: sanitizedLimit,
        where: {
          deletedAt: null,
          ...filters,
        },
        include: {
          profile: {
            select: {
              id: true,
              avatar: true,
              phone: true,
              address: true,
              birthday: true,
              userId: true,
              translations: {
                where: { language: lang as any },
                take: 1,
                select: {
                  language: true,
                  firstName: true,
                  lastName: true,
                  bio: true,
                },
              },
            },
          },
        },
        orderBy,
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          ...filters,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / sanitizedLimit);

    return {
      data: users,
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages,
      hasNext: sanitizedPage < totalPages,
      hasPrev: sanitizedPage > 1,
    };
  }

  /**
   * ✅ FIXED: Optimized search dengan proper Prisma full-text search
   */
  async searchUsersOptimized({
    query,
    page = 1,
    limit = 10,
    lang,
  }: {
    query: string;
    page?: number;
    limit?: number;
    lang: string;
  }): Promise<UserSearchResult> {
    const sanitizedLimit = Math.min(
      Math.max(1, limit),
      this.config.maxPageSize,
    );
    const sanitizedPage = Math.max(1, page);
    const skip = (sanitizedPage - 1) * sanitizedLimit;

    // ✅ Sanitize search query
    const sanitizedQuery = query.trim().toLowerCase();
    if (!sanitizedQuery) {
      return {
        data: [],
        total: 0,
        page: sanitizedPage,
        limit: sanitizedLimit,
        totalPages: 0,
      };
    }

    // ✅ FIXED: Use Prisma's built-in search capabilities instead of raw SQL
    const searchConditions = {
      deletedAt: null,
      OR: [
        {
          email: {
            contains: sanitizedQuery,
            mode: 'insensitive' as const,
          },
        },
        {
          profile: {
            translations: {
              some: {
                language: lang as any,
                OR: [
                  {
                    firstName: {
                      contains: sanitizedQuery,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    lastName: {
                      contains: sanitizedQuery,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    };

    // ✅ Execute search dan count in parallel
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: searchConditions,
        skip,
        take: sanitizedLimit,
        include: {
          profile: {
            select: {
              id: true,
              avatar: true,
              phone: true,
              address: true,
              birthday: true,
              userId: true,
              translations: {
                where: { language: lang as any },
                take: 1,
                select: {
                  language: true,
                  firstName: true,
                  lastName: true,
                  bio: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.user.count({
        where: searchConditions,
      }),
    ]);

    const totalPages = Math.ceil(total / sanitizedLimit);

    return {
      data: users,
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages,
    };
  }

  /**
   * ✅ FIXED: Advanced search dengan PostgreSQL full-text search (when available)
   */
  async searchUsersWithFullText({
    query,
    page = 1,
    limit = 10,
    lang,
  }: {
    query: string;
    page?: number;
    limit?: number;
    lang: string;
  }): Promise<UserSearchResult> {
    const sanitizedLimit = Math.min(
      Math.max(1, limit),
      this.config.maxPageSize,
    );
    const sanitizedPage = Math.max(1, page);
    const skip = (sanitizedPage - 1) * sanitizedLimit;

    try {
      // ✅ FIXED: Use type assertions for $queryRaw results
      const users = await this.prisma.$queryRaw`
        SELECT DISTINCT u.*, 
               pt."firstName", 
               pt."lastName",
               pt."bio",
               ts_rank(
                 to_tsvector('english', pt."firstName" || ' ' || pt."lastName"), 
                 plainto_tsquery('english', ${query})
               ) as rank
        FROM "User" u
        LEFT JOIN "Profile" p ON u.id = p."userId"
        LEFT JOIN "ProfileTranslation" pt ON p.id = pt."profileId" AND pt.language = ${lang}
        WHERE u."deletedAt" IS NULL
          AND (
            to_tsvector('english', pt."firstName" || ' ' || pt."lastName") @@ plainto_tsquery('english', ${query})
            OR u.email ILIKE ${`%${query}%`}
          )
        ORDER BY rank DESC NULLS LAST, u."createdAt" DESC
        LIMIT ${sanitizedLimit} OFFSET ${skip}
      `;

      const totalResult = await this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT u.id) as count
        FROM "User" u
        LEFT JOIN "Profile" p ON u.id = p."userId"
        LEFT JOIN "ProfileTranslation" pt ON p.id = pt."profileId" AND pt.language = ${lang}
        WHERE u."deletedAt" IS NULL
          AND (
            to_tsvector('english', pt."firstName" || ' ' || pt."lastName") @@ plainto_tsquery('english', ${query})
            OR u.email ILIKE ${`%${query}%`}
          )
      `;

      // ✅ FIXED: Safe type handling with proper checks
      let total = 0;
      if (Array.isArray(totalResult) && totalResult.length > 0) {
        const firstResult = totalResult[0];
        total = firstResult?.count ? Number(firstResult.count) : 0;
      }

      const totalPages = Math.ceil(total / sanitizedLimit);

      return {
        data: Array.isArray(users) ? users : [],
        total,
        page: sanitizedPage,
        limit: sanitizedLimit,
        totalPages,
      };
    } catch (error) {
      // ✅ Fallback to regular search if full-text search fails
      this.logger.warn(
        'Full-text search failed, falling back to regular search:',
        error.message,
      );
      return await this.searchUsersOptimized({ query, page, limit, lang });
    }
  }

  /**
   * ✅ FIXED: Bulk profile translation operations dengan proper error handling
   */
  async bulkUpsertProfileTranslations(
    translations: Array<{
      profileId: string;
      language: string;
      firstName: string;
      lastName: string;
      bio?: string;
    }>,
  ): Promise<any[]> {
    if (!translations.length) return [];

    // ✅ Validate data
    const validTranslations = translations.filter(
      (t) => t.profileId && t.language && t.firstName && t.lastName,
    );

    if (validTranslations.length !== translations.length) {
      this.logger.warn(
        `Filtered out ${translations.length - validTranslations.length} invalid translations`,
      );
    }

    if (!this.config.enableBulkOperations || validTranslations.length <= 5) {
      // ✅ Use individual operations untuk small datasets
      return await this.prisma.$transaction(
        validTranslations.map((t) =>
          this.prisma.profileTranslation.upsert({
            where: {
              profileId_language: {
                profileId: t.profileId,
                language: t.language as any,
              },
            },
            update: {
              firstName: t.firstName,
              lastName: t.lastName,
              bio: t.bio,
              updatedAt: new Date(),
            },
            create: {
              profileId: t.profileId,
              language: t.language as any,
              firstName: t.firstName,
              lastName: t.lastName,
              bio: t.bio,
            },
          }),
        ),
      );
    }

    // ✅ Use enhanced bulk upsert untuk larger datasets
    return await this.prisma.bulkUpsert(
      'profileTranslation',
      validTranslations,
      ['profileId', 'language'],
    );
  }

  /**
   * ✅ FIXED: Cached user statistics dengan proper typing
   */
  async getUserStatsCached(
    ttl: number = this.config.defaultCacheTTL,
  ): Promise<UserStats> {
    const cacheKey = 'user_stats_v1';

    return await this.prisma.cachedQuery(
      cacheKey,
      async () => {
        // ✅ FIXED: Use Prisma aggregations instead of raw SQL
        const [totalUsers, activeUsers, verifiedUsers, recentlyActiveUsers] =
          await Promise.all([
            this.prisma.user.count({
              where: { deletedAt: null },
            }),
            this.prisma.user.count({
              where: { deletedAt: null, isActive: true },
            }),
            this.prisma.user.count({
              where: { deletedAt: null, isVerified: true },
            }),
            this.prisma.user.count({
              where: {
                deletedAt: null,
                lastLoginAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                },
              },
            }),
          ]);

        return {
          total: totalUsers,
          active: activeUsers,
          verified: verifiedUsers,
          inactive: totalUsers - activeUsers,
          unverified: totalUsers - verifiedUsers,
          recentlyActive: recentlyActiveUsers,
        };
      },
      ttl,
    );
  }

  /**
   * ✅ NEW: Optimized category queries
   */
  async findCategoriesOptimized({
    lang,
    includeInactive = false,
  }: {
    lang: string;
    includeInactive?: boolean;
  }) {
    return await this.prisma.category.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        translations: {
          where: { language: lang as any },
          take: 1,
          select: {
            language: true,
            name: true,
            description: true,
            metaTitle: true,
            metaDescription: true,
          },
        },
        _count: {
          select: {
            posts: {
              where: {
                status: 'PUBLISHED',
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ✅ NEW: Optimized post queries dengan proper filtering
   */
  async findPostsOptimized({
    page = 1,
    limit = 10,
    lang,
    status = 'PUBLISHED',
    categoryId,
    authorId,
  }: {
    page?: number;
    limit?: number;
    lang: string;
    status?: string;
    categoryId?: string;
    authorId?: string;
  }): Promise<OffsetPaginatedResult<any>> {
    const sanitizedLimit = Math.min(
      Math.max(1, limit),
      this.config.maxPageSize,
    );
    const sanitizedPage = Math.max(1, page);
    const skip = (sanitizedPage - 1) * sanitizedLimit;

    const whereConditions = {
      deletedAt: null,
      status: status as any,
      ...(categoryId && { categoryId }),
      ...(authorId && { authorId }),
    };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: whereConditions,
        skip,
        take: sanitizedLimit,
        include: {
          author: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  avatar: true,
                  translations: {
                    where: { language: lang as any },
                    take: 1,
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          category: {
            select: {
              id: true,
              slug: true,
              translations: {
                where: { language: lang as any },
                take: 1,
                select: {
                  name: true,
                },
              },
            },
          },
          translations: {
            where: { language: lang as any },
            take: 1,
            select: {
              language: true,
              title: true,
              content: true,
              excerpt: true,
              languageSlug: true,
              metaTitle: true,
              metaDescription: true,
            },
          },
          _count: {
            select: {
              comments: {
                where: {
                  isApproved: true,
                  deletedAt: null,
                },
              },
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.post.count({ where: whereConditions }),
    ]);

    const totalPages = Math.ceil(total / sanitizedLimit);

    return {
      data: posts,
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages,
      hasNext: sanitizedPage < totalPages,
      hasPrev: sanitizedPage > 1,
    };
  }

  /**
   * ✅ FIXED: Performance monitoring helper
   */
  async analyzeQueryPerformance() {
    try {
      // ✅ FIXED: Use health check instead of non-existent getQueryStats
      const health = await this.prisma.healthCheck();
      const dbMetrics = await this.prisma.getDatabaseMetrics();

      // ✅ Create query stats from available data
      const queryStats = {
        totalQueries: dbMetrics?.totalQueries || 0,
        slowQueries: dbMetrics?.slowQueries || 0,
        averageQueryTime: dbMetrics?.avgQueryTime || 0,
        slowQueryRatio:
          dbMetrics?.slowQueries && dbMetrics?.totalQueries
            ? `${((dbMetrics.slowQueries / dbMetrics.totalQueries) * 100).toFixed(2)}%`
            : '0%',
      };

      return {
        queryPerformance: queryStats,
        databaseHealth: health.healthy,
        connectionHealth: dbMetrics?.connectionPoolHealth || 'unknown',
        recommendations: this.generatePerformanceRecommendations(queryStats),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to analyze query performance:', error);

      return {
        queryPerformance: {
          totalQueries: 0,
          slowQueries: 0,
          averageQueryTime: 0,
          slowQueryRatio: '0%',
        },
        databaseHealth: false,
        connectionHealth: 'critical',
        recommendations: [
          'Unable to analyze performance - check database connection',
        ],
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * ✅ NEW: Generate performance recommendations
   */
  private generatePerformanceRecommendations(queryStats: any): string[] {
    const recommendations: string[] = [];

    if (queryStats.averageQueryTime > 500) {
      recommendations.push(
        'Consider adding database indices untuk slow queries',
      );
    }

    if (
      queryStats.slowQueryRatio &&
      parseFloat(queryStats.slowQueryRatio) > 10
    ) {
      recommendations.push(
        'High slow query ratio detected - review query patterns',
      );
    }

    if (queryStats.totalQueries > 10000 && queryStats.averageQueryTime > 200) {
      recommendations.push('Consider implementing query result caching');
    }

    if (recommendations.length === 0) {
      recommendations.push('Query performance is optimal');
    }

    return recommendations;
  }
}
