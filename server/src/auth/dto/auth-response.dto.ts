// src/auth/dto/auth-response.dto.ts - NEW FILE
import { SafeUser } from '../../users/types/user.types';

/**
 * Authentication Response Types
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface RegisterResponse {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface LoginResponse {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface LogoutResponse {
  message: string;
}
