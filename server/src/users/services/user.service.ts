// src/users/services/user.service.ts - FIXED IMPORTS (if missing)
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../../i18n/constants/languages';
import { SafeUser } from '../types/user.types';
import { UserMapper } from '../../shared/mappers/user.mapper';
import { LanguageConverter } from '../../shared/utils/language-converter';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {}

  // ... rest of the implementation stays the same as in the refactored version
  // (This is just fixing the import issue)

  async create(
    createUserDto: CreateUserDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    // Implementation here...
    return {} as SafeUser; // Placeholder
  }

  async findById(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    // Implementation here...
    return {} as SafeUser; // Placeholder
  }

  // Add other methods as needed...
}

// src/users/services/profile.service.ts - FIXED IMPORTS (if missing)
import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
import { LanguageConverter } from '../../shared/utils/language-converter';
import { UserService } from './user.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
    private readonly userService: UserService,
  ) {}

  // Implementation methods...
  async createUserWithProfile(
    createUserDto: CreateUserWithProfileDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<UserWithProfile> {
    // Implementation here...
    return {} as UserWithProfile; // Placeholder
  }

  // Add other methods as needed...
}

// src/common/cache/cache.service.ts - FIXED IMPORTS (if missing)
import { Injectable } from '@nestjs/common';
import { LRUCache } from './lru-cache';
import { SafeUser } from '../../users/types/user.types';

@Injectable()
export class CacheService {
  private readonly userCache = new LRUCache<string, SafeUser>(1000);
  private readonly translationCache = new LRUCache<string, string>(5000);

  async getUserFromCache(id: string): Promise<SafeUser | null> {
    return this.userCache.get(id) || null;
  }

  async setUserInCache(id: string, user: SafeUser): Promise<void> {
    this.userCache.set(id, user);
  }

  async invalidateUserCache(id: string): Promise<void> {
    this.userCache.delete(id);
  }

  getCacheStats() {
    return {
      user: this.userCache.getMetrics(),
      translation: this.translationCache.getMetrics(),
    };
  }
}

// src/shared/mappers/user.mapper.ts - FIXED IMPORTS (if missing)
import { User, Profile, ProfileTranslation, Language } from '@prisma/client';
import {
  SafeUser,
  UserWithProfile,
  CleanTranslation,
} from '../../users/types/user.types';

export class UserMapper {
  /**
   * Convert Prisma User to SafeUser (remove password)
   */
  static toSafeUser(prismaUser: User): SafeUser {
    const { password, ...safeUser } = prismaUser;
    return safeUser as SafeUser;
  }

  /**
   * Convert ProfileTranslation to CleanTranslation
   */
  static toCleanTranslation(translation: ProfileTranslation): CleanTranslation {
    return {
      language: translation.language,
      firstName: translation.firstName,
      lastName: translation.lastName,
      bio: translation.bio || undefined,
    };
  }

  /**
   * Convert Profile with translations to clean format
   */
  static toCleanProfile(
    profile: Profile & { translations: ProfileTranslation[] },
  ) {
    return {
      id: profile.id,
      avatar: profile.avatar,
      phone: profile.phone,
      address: profile.address,
      birthday: profile.birthday,
      userId: profile.userId,
      translations: profile.translations.map(this.toCleanTranslation),
    };
  }

  /**
   * Convert User with Profile to UserWithProfile
   */
  static toUserWithProfile(
    user: User,
    profile?: Profile & { translations: ProfileTranslation[] },
  ): UserWithProfile {
    const safeUser = this.toSafeUser(user);

    if (profile) {
      return {
        ...safeUser,
        profile: this.toCleanProfile(profile),
      };
    }

    return safeUser;
  }
}

// src/auth/strategies/jwt.strategy.ts - FIXED IMPORTS
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findOne(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
    };
  }
}

// src/common/services/multilingual-base.service.ts - FIXED IMPORTS
import { Injectable } from '@nestjs/common';
import { EnhancedDatabaseService } from '../../database/enhanced-database.service';
import { LanguageService } from '../../i18n/services/language.service';
import { SupportedLanguage } from '../../i18n/constants/languages';

/**
 * Abstract base service yang menyediakan fungsionalitas multilingual
 * untuk semua services yang membutuhkan dukungan multi-bahasa
 */
@Injectable()
export abstract class MultilingualBaseService {
  constructor(
    protected readonly prisma: EnhancedDatabaseService,
    protected readonly languageService: LanguageService,
  ) {}

  /**
   * Mencari translation dengan fallback ke bahasa default
   */
  protected async findTranslationWithFallback<T>(
    findTranslation: (language: string) => Promise<T | null>,
    requestedLanguage: SupportedLanguage,
  ): Promise<T | null> {
    // Coba cari di bahasa yang diminta dulu
    const requestedTranslation = await findTranslation(requestedLanguage);
    if (requestedTranslation) {
      return requestedTranslation;
    }

    // Jika tidak ketemu, coba bahasa default
    const defaultLanguage = this.languageService.getDefaultLanguage();
    if (defaultLanguage !== requestedLanguage) {
      const fallbackTranslation = await findTranslation(defaultLanguage);
      if (fallbackTranslation) {
        return fallbackTranslation;
      }
    }

    return null;
  }

  // Add other helper methods as needed...
}

// Create missing package.json script (if needed)
// package.json scripts section should include:
/*
{
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**\/*.ts\" \"test/**\/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**\/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./src/test/jest-e2e.json"
  }
}
*/
