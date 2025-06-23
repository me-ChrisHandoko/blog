// src/users/services/user-query.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../../i18n/constants/languages';
import {
  SafeUser,
  UserWithProfile,
  PaginatedResponse,
} from '../types/user.types';
import { UserMapper } from '../../shared/mappers/user.mapper';

export interface UserSearchFilters {
  role?: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
  isActive?: boolean;
  isVerified?: boolean;
  language?: SupportedLanguage;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
}

export interface UserSearchOptions {
  includeProfile?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'createdAt' | 'lastLoginAt' | 'email';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class UserQueryService {
  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {}

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
    const skip = (page - 1) * limit;

    // Build where clause
    const where = this.buildWhereClause(filters, options);

    // Build order by clause
    const orderBy = this.buildOrderByClause(options);

    // Build include clause
    const include = this.buildIncludeClause(options, lang);

    const [users, total] = await Promise.all([
      this.database.monitoredQuery(async () => {
        return await this.database.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include,
        });
      }, 'find-users-paginated'),
      this.database.monitoredQuery(async () => {
        return await this.database.user.count({ where });
      }, 'count-users-filtered'),
    ]);

    // Format users
    const formattedUsers = users.map((user: any) => {
      if (options.includeProfile && user.profile) {
        return UserMapper.toUserWithProfile(user, user.profile);
      }
      return UserMapper.toSafeUser(user);
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: formattedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Search users by text query
   */
  async searchUsers({
    query,
    page = 1,
    limit = 10,
    filters = {},
    options = {},
    lang = getDefaultLanguage(),
  }: {
    query: string;
    page?: number;
    limit?: number;
    filters?: UserSearchFilters;
    options?: UserSearchOptions;
    lang?: SupportedLanguage;
  }): Promise<PaginatedResponse<UserWithProfile | SafeUser>> {
    const sanitizedQuery = query.trim().toLowerCase();
    if (!sanitizedQuery) {
      return this.findUsers({ page, limit, filters, options, lang });
    }

    const skip = (page - 1) * limit;

    // Build base where clause
    const baseWhere = this.buildWhereClause(filters, options);

    // Add search conditions
    const searchWhere = {
      ...baseWhere,
      OR: [
        {
          email: {
            contains: sanitizedQuery,
            mode: 'insensitive' as const,
          },
        },
        ...(options.includeProfile
          ? [
              {
                profile: {
                  translations: {
                    some: {
                      language: lang,
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
            ]
          : []),
      ],
    };

    const orderBy = this.buildOrderByClause(options);
    const include = this.buildIncludeClause(options, lang);

    const [users, total] = await Promise.all([
      this.database.monitoredQuery(async () => {
        return await this.database.user.findMany({
          where: searchWhere,
          skip,
          take: limit,
          orderBy,
          include,
        });
      }, 'search-users'),
      this.database.monitoredQuery(async () => {
        return await this.database.user.count({ where: searchWhere });
      }, 'count-search-users'),
    ]);

    // Format users
    const formattedUsers = users.map((user: any) => {
      if (options.includeProfile && user.profile) {
        return UserMapper.toUserWithProfile(user, user.profile);
      }
      return UserMapper.toSafeUser(user);
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: formattedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
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
    return (await this.findUsers({
      page,
      limit,
      filters: { role },
      options: { includeProfile: false },
      lang,
    })) as PaginatedResponse<SafeUser>;
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private buildWhereClause(
    filters: UserSearchFilters,
    options: UserSearchOptions,
  ) {
    const where: any = {};

    // Soft delete filter
    if (!options.includeDeleted) {
      where.deletedAt = null;
    }

    // Apply filters
    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.isVerified !== undefined) {
      where.isVerified = filters.isVerified;
    }

    if (filters.language) {
      where.preferredLanguage = filters.language;
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    if (filters.lastLoginAfter || filters.lastLoginBefore) {
      where.lastLoginAt = {};
      if (filters.lastLoginAfter) {
        where.lastLoginAt.gte = filters.lastLoginAfter;
      }
      if (filters.lastLoginBefore) {
        where.lastLoginAt.lte = filters.lastLoginBefore;
      }
    }

    return where;
  }

  private buildOrderByClause(options: UserSearchOptions) {
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    return { [sortBy]: sortOrder };
  }

  private buildIncludeClause(
    options: UserSearchOptions,
    lang: SupportedLanguage,
  ) {
    if (!options.includeProfile) {
      return undefined;
    }

    return {
      profile: {
        include: {
          translations: {
            where: { language: lang },
            take: 1,
          },
        },
      },
    };
  }
}
