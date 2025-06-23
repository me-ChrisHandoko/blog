// src/users/services/user.service.ts - CLEAN USER SERVICE ONLY
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
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    private readonly database: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {}

  /**
   * Create a new user
   */
  async create(
    createUserDto: CreateUserDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    // Check if email already exists
    const existingUser = await this.database.user.findUnique({
      where: { email: createUserDto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException(
        this.languageService.translate('users.messages.emailExists', lang),
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    // Create user
    const user = await this.database.monitoredQuery(async () => {
      return await this.database.user.create({
        data: {
          email: createUserDto.email.toLowerCase(),
          password: hashedPassword,
          preferredLanguage: createUserDto.preferredLanguage || 'EN',
        },
      });
    }, 'create-user');

    return UserMapper.toSafeUser(user);
  }

  /**
   * Find user by ID
   */
  async findById(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    const user = await this.database.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    return UserMapper.toSafeUser(user);
  }

  /**
   * Find user by email
   */
  async findByEmail(
    email: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    const user = await this.database.user.findUnique({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    return UserMapper.toSafeUser(user);
  }

  /**
   * Update user
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    // Check if user exists
    const existingUser = await this.database.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existingUser) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.database.user.findUnique({
        where: { email: updateUserDto.email.toLowerCase() },
      });

      if (emailExists) {
        throw new ConflictException(
          this.languageService.translate('users.messages.emailExists', lang),
        );
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateUserDto.email) {
      updateData.email = updateUserDto.email.toLowerCase();
    }

    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 12);
    }

    if (updateUserDto.isActive !== undefined) {
      updateData.isActive = updateUserDto.isActive;
    }

    if (updateUserDto.isVerified !== undefined) {
      updateData.isVerified = updateUserDto.isVerified;
    }

    if (updateUserDto.preferredLanguage) {
      updateData.preferredLanguage = updateUserDto.preferredLanguage;
    }

    // Update user
    const updatedUser = await this.database.monitoredQuery(async () => {
      return await this.database.user.update({
        where: { id },
        data: updateData,
      });
    }, 'update-user');

    return UserMapper.toSafeUser(updatedUser);
  }

  /**
   * Soft delete user
   */
  async softDelete(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<void> {
    const user = await this.database.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    await this.database.monitoredQuery(async () => {
      return await this.database.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });
    }, 'soft-delete-user');
  }

  /**
   * Restore soft deleted user
   */
  async restore(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    const user = await this.database.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    if (!user.deletedAt) {
      throw new BadRequestException(
        this.languageService.translate('users.messages.notDeleted', lang),
      );
    }

    const restoredUser = await this.database.monitoredQuery(async () => {
      return await this.database.user.update({
        where: { id },
        data: {
          deletedAt: null,
          isActive: true,
        },
      });
    }, 'restore-user');

    return UserMapper.toSafeUser(restoredUser);
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.database.monitoredQuery(async () => {
      return await this.database.user.update({
        where: { id },
        data: { lastLoginAt: new Date() },
      });
    }, 'update-last-login');
  }

  /**
   * Check if user exists
   */
  async exists(id: string): Promise<boolean> {
    const user = await this.database.user.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    return !!user;
  }

  /**
   * Get user count
   */
  async count(includeDeleted: boolean = false): Promise<number> {
    return await this.database.user.count({
      where: includeDeleted ? {} : { deletedAt: null },
    });
  }

  /**
   * Change user password
   */
  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<void> {
    const user = await this.database.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException(
        this.languageService.translate(
          'auth.messages.invalidCredentials',
          lang,
        ),
      );
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.database.monitoredQuery(async () => {
      return await this.database.user.update({
        where: { id },
        data: { password: hashedNewPassword },
      });
    }, 'change-password');
  }

  /**
   * Activate/Deactivate user
   */
  async toggleActivation(
    id: string,
    isActive: boolean,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    const user = await this.database.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    const updatedUser = await this.database.monitoredQuery(async () => {
      return await this.database.user.update({
        where: { id },
        data: { isActive },
      });
    }, 'toggle-user-activation');

    return UserMapper.toSafeUser(updatedUser);
  }

  /**
   * Verify user email
   */
  async verifyEmail(
    id: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): Promise<SafeUser> {
    const user = await this.database.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(
        this.languageService.translate('users.messages.notFound', lang),
      );
    }

    const verifiedUser = await this.database.monitoredQuery(async () => {
      return await this.database.user.update({
        where: { id },
        data: { isVerified: true },
      });
    }, 'verify-user-email');

    return UserMapper.toSafeUser(verifiedUser);
  }
}
