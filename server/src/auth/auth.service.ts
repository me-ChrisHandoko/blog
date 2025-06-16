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
import { SupportedLanguage } from 'src/i18n/constants/languages';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto, lang: SupportedLanguage) {
    // Validate password confirmation
    if (registerDto.password !== registerDto.confirmPassword) {
      throw new ConflictException('validation.password.mismatch');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('validation.email.alreadyExists');
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

  async login(loginDto: LoginDto, lang: SupportedLanguage) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Update last login
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
  }

  async refreshToken(refreshToken: string) {
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
        throw new UnauthorizedException('Invalid refresh token');
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
      throw new UnauthorizedException('Invalid refresh token');
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

  private async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }

    return null;
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
