// src/users/dto/update-user.dto.ts - Simple update DTO
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { SupportedLanguage } from '../../i18n/constants/languages';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsBoolean({ message: 'validation.generic.invalid' })
  isActive?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'validation.generic.invalid' })
  isVerified?: boolean;

  @IsOptional()
  @IsEnum(SupportedLanguage, { message: 'validation.language.unsupported' })
  preferredLanguage?: SupportedLanguage;
}
