// src/users/dto/create-user.dto.ts - FIXED VERSION
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsIn, // ✅ CHANGED: Use IsIn instead of IsEnum
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
} from '../../i18n/constants/languages';
import { ProfileTranslationDto } from './profile-translation.dto';

/**
 * DTO untuk create user basic (tanpa profile)
 */
export class CreateUserDto {
  @IsEmail({}, { message: 'validation.email.invalid' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @IsString({ message: 'validation.password.required' })
  @MinLength(8, { message: 'validation.password.tooWeak' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'validation.password.tooWeak',
  })
  password: string;

  @IsOptional()
  // ✅ FIXED: Use @IsIn with array instead of @IsEnum with type
  @IsIn(SUPPORTED_LANGUAGES, { message: 'validation.language.unsupported' })
  preferredLanguage?: SupportedLanguage;
}

/**
 * DTO untuk create user dengan multilingual profile
 */
export class CreateUserWithProfileDto extends CreateUserDto {
  // Profile basic info (universal data)
  @IsOptional()
  @IsString({ message: 'validation.generic.invalid' })
  avatar?: string;

  @IsOptional()
  @IsString({ message: 'validation.phone.invalid' })
  @Matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/, {
    message: 'validation.phone.invalid',
  })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'validation.generic.invalid' })
  @MaxLength(200, { message: 'validation.generic.tooLong' })
  @Transform(({ value }) => value?.trim())
  address?: string;

  @IsOptional()
  @IsString({ message: 'validation.generic.invalid' })
  birthday?: string; // ISO date string

  // Profile translations (multilingual data)
  @IsArray({ message: 'validation.generic.invalid' })
  @ValidateNested({ each: true })
  @Type(() => ProfileTranslationDto)
  profileTranslations: ProfileTranslationDto[];
}
