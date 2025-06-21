// src/users/types/user.types.ts - NEW FILE
import { User, Profile, Language } from '@prisma/client';

/**
 * Safe User type - excludes sensitive fields
 * Based on actual Prisma schema structure
 */
export type SafeUser = {
  id: string;
  email: string;
  role: User['role'];
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  preferredLanguage: Language;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/**
 * Profile Translation type for API responses
 */
export type CleanTranslation = {
  language: Language;
  firstName: string;
  lastName: string;
  bio?: string; // Convert null to undefined for API consistency
};

/**
 * Profile with cleaned translations
 */
export type ProfileWithTranslations = {
  id: string;
  avatar: string | null;
  phone: string | null;
  address: string | null;
  birthday: Date | null;
  userId: string;
  translations: CleanTranslation[];
};

/**
 * User with optional profile and current translation
 */
export type UserWithProfile = SafeUser & {
  profile?: ProfileWithTranslations;
  translation?: CleanTranslation; // Current language translation
};

/**
 * Prisma raw types for internal use
 */
export type PrismaProfileTranslation = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  language: Language;
  firstName: string;
  lastName: string;
  bio: string | null;
  profileId: string;
};

export type PrismaProfileWithTranslations = Profile & {
  translations: PrismaProfileTranslation[];
};

/**
 * User statistics response
 */
export type UserStats = {
  total: number;
  active: number;
  verified: number;
  inactive: number;
  unverified: number;
};

/**
 * Pagination metadata
 */
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/**
 * Paginated response wrapper
 */
export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

/**
 * User creation response
 */
export type CreateUserResponse = SafeUser;

/**
 * User with profile creation response
 */
export type CreateUserWithProfileResponse = UserWithProfile;
