// src/auth/auth.service.ts - FIXED: Timing Attack Prevention
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/prisma.service';
import { UsersService } from 'src/users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import {
  getDefaultLanguage,
  SupportedLanguage,
} from 'src/i18n/constants/languages';
import * as bcrypt from 'bcryptjs';
import { LanguageService } from 'src/i18n/services/language.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private languageService: LanguageService,
  ) {}

  @Cron('0 0 * * *') // Daily cleanup
  async cleanupExpiredSessions() {
    const deleted = await this.prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            isActive: false,
            updatedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
    });

    Logger.log(`🧹 Cleaned up ${deleted.count} expired sessions`);
  }

  async getSessionAnalytics(userId: string) {
    return this.prisma.session.groupBy({
      by: ['userAgent'],
      where: { userId, isActive: true },
      _count: true,
    });
  }

  async getActiveSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async terminateSession(userId: string, sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId, userId },
      data: { isActive: false },
    });
  }

  async register(registerDto: RegisterDto, lang: SupportedLanguage) {
    // Validate password confirmation
    if (registerDto.password !== registerDto.confirmPassword) {
      const message = this.languageService.translate(
        'validation.password.mismatch',
        lang,
      );
      throw new ConflictException(message);
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      const message = this.languageService.translate(
        'validation.email.alreadyExists',
        lang,
      );
      throw new ConflictException(message);
    }

    // Create user
    const user = await this.usersService.create(
      {
        email: registerDto.email,
        password: registerDto.password,
        preferredLanguage: lang,
      },
      lang,
    );

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Save refresh token
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * FIXED: Login method with timing attack prevention
   */
  async login(loginDto: LoginDto, lang: SupportedLanguage) {
    // SECURITY: Always perform the same operations regardless of user existence
    // This prevents timing attacks that could reveal valid email addresses

    const startTime = process.hrtime.bigint();

    // Step 1: Always fetch user (even if not exists)
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase() },
    });

    // Step 2: Always perform password comparison (prevent timing differences)
    let isValidCredentials = false;

    if (user) {
      // Real password comparison
      isValidCredentials = await bcrypt.compare(
        loginDto.password,
        user.password,
      );
    } else {
      // SECURITY: Dummy password comparison with same computational cost
      // This ensures consistent timing whether user exists or not
      await bcrypt.compare(
        loginDto.password,
        '$2a$12$dummyhashtopreventtimingattacks',
      );
      isValidCredentials = false;
    }

    // Step 3: Add consistent delay to normalize response time
    const minExecutionTime = 100; // 100ms minimum execution time
    const elapsedTime = Number(process.hrtime.bigint() - startTime) / 1_000_000; // Convert to ms

    if (elapsedTime < minExecutionTime) {
      await new Promise((resolve) =>
        setTimeout(resolve, minExecutionTime - elapsedTime),
      );
    }

    // Step 4: Single validation check with generic error message
    if (!user || !isValidCredentials || !user.isActive) {
      // SECURITY: Same error message for all failure cases
      // - User doesn't exist
      // - Wrong password
      // - User inactive
      // This prevents user enumeration attacks
      const message = this.languageService.translate(
        'auth.messages.invalidCredentials',
        lang,
      );
      throw new UnauthorizedException(message);
    }

    // Step 5: Successful login processing
    try {
      // Update last login timestamp
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate tokens
      const tokens = await this.generateTokens(user.id, user.email, user.role);

      // Save refresh token
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      // Generic error for any unexpected issues
      const message = this.languageService.translate(
        'auth.messages.loginFailed',
        lang,
      );
      throw new UnauthorizedException(message);
    }
  }

  // REMOVED: validateUserSecure function - was not being used anywhere
  // The timing attack prevention is now implemented directly in the login method

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
        const message = this.languageService.translate(
          'auth.messages.invalidToken',
          lang,
        );
        throw new UnauthorizedException(message);
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
      const message = this.languageService.translate(
        'auth.messages.invalidToken',
        lang,
      );
      throw new UnauthorizedException(message);
    }
  }

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

  getLocalizedMessage(
    key: string,
    lang: SupportedLanguage = getDefaultLanguage(),
  ): string {
    return this.languageService.translate(key, lang);
  }

  /**
   * DEPRECATED: Old method with timing vulnerability
   * Kept for reference only - shows the security issue we fixed
   *
   * PROBLEMS:
   * 1. Different timing if user exists vs doesn't exist
   * 2. Password comparison only happens if user exists
   * 3. Can be exploited for user enumeration attacks
   */
  private async validateUserOld_DEPRECATED_DO_NOT_USE(
    email: string,
    password: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // VULNERABILITY: This check happens AFTER database query
    // Different timing if user exists vs doesn't exist
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }

    return null; // ⚠️ TIMING ATTACK: Fast return if user doesn't exist
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { email, sub: userId, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    };
  }

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

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}
