// src/auth/auth.controller.ts - FIXED VERSION
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import { CurrentLanguage } from 'src/i18n/decorators/current-language.decorator';
import { SupportedLanguage } from 'src/i18n/constants/languages';
import { CurrentUser } from './decorators/current-user.decorator';
import { LanguageService } from 'src/i18n/services/language.service'; // ✅ ADDED

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly languageService: LanguageService, // ✅ ADDED
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @CurrentLanguage() lang: SupportedLanguage,
  ) {
    return this.authService.register(registerDto, lang);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @CurrentLanguage() lang: SupportedLanguage,
  ) {
    return this.authService.login(loginDto, lang);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @CurrentLanguage() lang: SupportedLanguage,
  ) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken, lang);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @CurrentLanguage() lang: SupportedLanguage,
    @Body('refreshToken') refreshToken?: string,
  ) {
    await this.authService.logout(userId, refreshToken);
    return {
      // ✅ FIXED: Use languageService.translate instead of authService.getLocalizedMessage
      message: this.languageService.translate(
        'auth.messages.logoutSuccess',
        lang,
      ),
    };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @CurrentLanguage() lang: SupportedLanguage,
  ) {
    await this.authService.logout(userId);
    return {
      // ✅ FIXED: Use languageService.translate instead of authService.getLocalizedMessage
      message: this.languageService.translate(
        'auth.messages.logoutAllSuccess',
        lang,
      ),
    };
  }
}
