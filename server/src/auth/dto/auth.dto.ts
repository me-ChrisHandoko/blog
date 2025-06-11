import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'validation.email.invalid' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @IsString({ message: 'validation.password.required' })
  @MinLength(8, { message: 'validation.password.tooWeak' })
  password: string;
}

export class RegisterDto extends LoginDto {
  @IsString({ message: 'validation.password.required' })
  @MinLength(8, { message: 'validation.password.tooWeak' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'validation.password.tooWeak',
  })
  confirmPassword: string;
}

export class RefreshTokenDto {
  @IsString({ message: 'validation.generic.required' })
  refreshToken: string;
}
