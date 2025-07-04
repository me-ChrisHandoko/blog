// src/users/dto/profile-translation.dto.ts - FIXED VERSION
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { TranslationBaseDto } from '../../common/dto/translation-base.dto';

/**
 * DTO untuk Profile Translation
 *
 * ✅ FIXED: Menggunakan TranslationBaseDto yang sudah diperbaiki
 * dengan @IsIn(SUPPORTED_LANGUAGES) instead of @IsEnum(SupportedLanguage)
 */
export class ProfileTranslationDto extends TranslationBaseDto {
  @IsString({ message: 'validation.name.required' })
  @MinLength(2, { message: 'validation.name.tooShort' })
  @MaxLength(50, { message: 'validation.name.tooLong' })
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @IsString({ message: 'validation.name.required' })
  @MinLength(2, { message: 'validation.name.tooShort' })
  @MaxLength(50, { message: 'validation.name.tooLong' })
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @IsOptional()
  @IsString({ message: 'validation.generic.invalid' })
  @MaxLength(500, { message: 'validation.generic.tooLong' })
  @Transform(({ value }) => value?.trim())
  bio?: string;
}

/**
 * DTO untuk update profile translation
 * Semua field optional kecuali language (inherited dari TranslationBaseDto)
 */
export class UpdateProfileTranslationDto extends TranslationBaseDto {
  @IsOptional()
  @IsString({ message: 'validation.name.required' })
  @MinLength(2, { message: 'validation.name.tooShort' })
  @MaxLength(50, { message: 'validation.name.tooLong' })
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'validation.name.required' })
  @MinLength(2, { message: 'validation.name.tooShort' })
  @MaxLength(50, { message: 'validation.name.tooLong' })
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsOptional()
  @IsString({ message: 'validation.generic.invalid' })
  @MaxLength(500, { message: 'validation.generic.tooLong' })
  @Transform(({ value }) => value?.trim())
  bio?: string;
}
