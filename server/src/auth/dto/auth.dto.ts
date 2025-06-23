// src/auth/dto/auth.dto.ts - FIXED VERSION
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom validator untuk memastikan password dan confirmPassword sama
 */
@ValidatorConstraint({ name: 'PasswordMatch', async: false })
export class PasswordMatchConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];
    return confirmPassword === relatedValue;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'validation.password.mismatch';
  }
}

/**
 * Custom validator untuk password complexity
 * Menggabungkan semua aturan password dalam satu validator
 */
@ValidatorConstraint({ name: 'PasswordComplexity', async: false })
export class PasswordComplexityConstraint
  implements ValidatorConstraintInterface
{
  validate(password: string, args: ValidationArguments): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }

    // Minimal 8 karakter
    if (password.length < 8) {
      return false;
    }

    // Harus mengandung: huruf besar, huruf kecil, angka, dan simbol
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[@$!%*?&]/.test(password);

    return hasLowercase && hasUppercase && hasNumbers && hasSymbols;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'validation.password.complexity';
  }
}

/**
 * Decorator untuk validasi password match
 */
export function PasswordMatch(property: string, validationOptions?: any) {
  return function (object: object, propertyName: string) {
    Validate(
      PasswordMatchConstraint,
      [property],
      validationOptions,
    )(object, propertyName);
  };
}

/**
 * Decorator untuk validasi password complexity
 */
export function PasswordComplexity(validationOptions?: any) {
  return function (object: object, propertyName: string) {
    Validate(
      PasswordComplexityConstraint,
      [],
      validationOptions,
    )(object, propertyName);
  };
}

/**
 * DTO untuk login user
 */
export class LoginDto {
  @IsEmail({}, { message: 'validation.email.invalid' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @IsString({ message: 'validation.password.required' })
  password: string;
}

/**
 * DTO untuk registrasi user - FIXED: Menghilangkan duplikasi validasi
 */
export class RegisterDto extends LoginDto {
  // Hanya satu validator untuk password dengan pesan yang komprehensif
  @IsString({ message: 'validation.password.required' })
  @PasswordComplexity({ message: 'validation.password.complexity' })
  declare password: string; // Override parent property dengan validasi baru

  // Validasi confirmPassword
  @IsString({ message: 'validation.password.required' })
  @PasswordMatch('password', { message: 'validation.password.mismatch' })
  confirmPassword: string;
}

/**
 * DTO untuk refresh token
 */
export class RefreshTokenDto {
  @IsString({ message: 'validation.generic.required' })
  refreshToken: string;
}
