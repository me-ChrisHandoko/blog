import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import { CurrentLanguage } from 'src/i18n/decorators/current-language.decorator';
import { SupportedLanguage } from 'src/i18n/constants/languages';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
    @CurrentLanguage() lang: SupportedLanguage, // ADDED: Missing lang parameter
  ) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken, lang); // FIXED: Added lang parameter
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @CurrentLanguage() lang: SupportedLanguage, // ADDED: For consistent error messages
    @Body('refreshToken') refreshToken?: string,
  ) {
    await this.authService.logout(userId, refreshToken);
    return {
      message: this.authService.getLocalizedMessage(
        'auth.messages.logoutSuccess',
        lang,
      ), // IMPROVED: Localized message
    };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @CurrentLanguage() lang: SupportedLanguage, // ADDED: For consistent error messages
  ) {
    await this.authService.logout(userId);
    return {
      message: this.authService.getLocalizedMessage(
        'auth.messages.logoutAllSuccess',
        lang,
      ), // IMPROVED: Localized message
    };
  }
}
