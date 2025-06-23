// src/users/dto/update-user.dto.ts - FIXED VERSION
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsBoolean, IsIn } from 'class-validator';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
} from '../../i18n/constants/languages';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsBoolean({ message: 'validation.generic.invalid' })
  isActive?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'validation.generic.invalid' })
  isVerified?: boolean;

  @IsOptional()
  // ✅ FIXED: Use @IsIn with array instead of @IsEnum with type
  @IsIn(SUPPORTED_LANGUAGES, { message: 'validation.language.unsupported' })
  preferredLanguage?: SupportedLanguage;
}
