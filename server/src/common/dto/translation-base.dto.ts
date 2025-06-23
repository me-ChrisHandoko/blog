// src/common/dto/translation-base.dto.ts - FIXED VERSION
import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsIn, // ✅ CHANGED: Use IsIn instead of IsEnum
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
} from '../../i18n/constants/languages';

/**
 * Base DTO untuk semua translation objects
 *
 * Semua DTO yang berhubungan dengan translation
 * sebaiknya extend dari class ini untuk consistency
 */
export abstract class TranslationBaseDto {
  // ✅ FIXED: Use @IsIn with array values instead of @IsEnum with type
  @IsIn(SUPPORTED_LANGUAGES, {
    message: 'validation.language.unsupported',
  })
  language: SupportedLanguage;
}

/**
 * DTO untuk translation yang memiliki name field
 * (Category, Tag, dll)
 */
export abstract class NamedTranslationDto extends TranslationBaseDto {
  @IsString({ message: 'validation.generic.invalid' })
  @MinLength(2, { message: 'validation.generic.tooShort' })
  @MaxLength(100, { message: 'validation.generic.tooLong' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsOptional()
  @IsString({ message: 'validation.generic.invalid' })
  @MaxLength(500, { message: 'validation.generic.tooLong' })
  @Transform(({ value }) => value?.trim())
  description?: string;
}

/**
 * DTO untuk translation dengan SEO fields
 */
export abstract class SeoTranslationDto extends NamedTranslationDto {
  @IsOptional()
  @IsString({ message: 'validation.generic.invalid' })
  @MaxLength(60, { message: 'validation.generic.tooLong' })
  @Transform(({ value }) => value?.trim())
  metaTitle?: string;

  @IsOptional()
  @IsString({ message: 'validation.generic.invalid' })
  @MaxLength(160, { message: 'validation.generic.tooLong' })
  @Transform(({ value }) => value?.trim())
  metaDescription?: string;
}
