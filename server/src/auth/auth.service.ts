// src/auth/auth.service.ts - FIXED TRANSLATION ISSUE
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnhancedDatabaseService } from '../database/enhanced-database.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import {
  SupportedLanguage,
  getDefaultLanguage,
} from '../i18n/constants/languages';
import * as bcrypt from 'bcryptjs';
import { LanguageService } from '../i18n/services/language.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly prisma: EnhancedDatabaseService,
    private readonly languageService: LanguageService,
  ) {
    console.log('🔐 AuthService initialized');
  }

  /**
   * Register new user - FIXED TRANSLATION
   */
  async register(registerDto: RegisterDto, lang: SupportedLanguage) {
    // Validate password confirmation
    if (registerDto.password !== registerDto.confirmPassword) {
      throw new ConflictException(
        this.languageService.translate('validation.password.mismatch', lang),
      );
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      // ✅ FIXED: Use proper translation key that exists in translation files
      throw new ConflictException(
        this.languageService.translate('validation.email.alreadyExists', lang),
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    try {
      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: registerDto.email.toLowerCase().trim(),
          password: hashedPassword,
          preferredLanguage: lang, // ✅ FIXED: Use the language from request
        },
      });

      // Generate tokens
      const tokens = await this.generateTokens(user.id, user.email, user.role);

      // Save refresh token
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      // Return safe user data
      const { password, ...safeUser } = user;

      return {
        user: safeUser,
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Registration failed:', error);
      throw new ConflictException(
        this.languageService.translate('common.messages.error', lang),
      );
    }
  }

  /**
   * User login - FIXED TRANSLATION
   */
  async login(loginDto: LoginDto, lang: SupportedLanguage) {
    const startTime = process.hrtime.bigint();

    // Fetch user
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase() },
    });

    // Password comparison (always perform to prevent timing attacks)
    let isValidCredentials = false;

    if (user) {
      isValidCredentials = await bcrypt.compare(
        loginDto.password,
        user.password,
      );
    } else {
      // Dummy comparison
      await bcrypt.compare(
        loginDto.password,
        '$2a$12$dummyhashtopreventtimingattacks',
      );
    }

    // Add consistent delay
    const minExecutionTime = 100; // 100ms
    const elapsedTime = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    if (elapsedTime < minExecutionTime) {
      await new Promise((resolve) =>
        setTimeout(resolve, minExecutionTime - elapsedTime),
      );
    }

    // Validate credentials
    if (!user || !isValidCredentials || !user.isActive) {
      throw new UnauthorizedException(
        this.languageService.translate(
          'auth.messages.invalidCredentials',
          lang,
        ),
      );
    }

    try {
      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate tokens
      const tokens = await this.generateTokens(user.id, user.email, user.role);

      // Save refresh token
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      // Return safe user data
      const { password, ...safeUser } = user;

      return {
        user: safeUser,
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Login failed:', error);
      throw new UnauthorizedException(
        this.languageService.translate('auth.messages.loginFailed', lang),
      );
    }
  }

  /**
   * Refresh token - FIXED TRANSLATION
   */
  async refreshToken(
    refreshToken: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Check if refresh token exists in database
      const session = await this.prisma.session.findFirst({
        where: {
          token: refreshToken,
          userId: payload.sub,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: { user: true },
      });

      if (!session) {
        throw new UnauthorizedException(
          this.languageService.translate('auth.messages.invalidToken', lang),
        );
      }

      // Generate new tokens
      const tokens = await this.generateTokens(
        session.user.id,
        session.user.email,
        session.user.role,
      );

      // Update refresh token in database
      await this.prisma.session.update({
        where: { id: session.id },
        data: { token: tokens.refreshToken },
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedException(
        this.languageService.translate('auth.messages.invalidToken', lang),
      );
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.session.updateMany({
        where: { userId, token: refreshToken },
        data: { isActive: false },
      });
    } else {
      // Logout from all devices
      await this.prisma.session.updateMany({
        where: { userId },
        data: { isActive: false },
      });
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { email, sub: userId, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
    };
  }

  /**
   * Save refresh token to database
   */
  private async saveRefreshToken(userId: string, refreshToken: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.session.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
        isActive: true,
      },
    });
  }
}
