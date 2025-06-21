export const APP_CONSTANTS = {
  MIN_LOGIN_EXECUTION_TIME: parseInt(process.env.MIN_LOGIN_TIME || '100'),
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
  LOCKOUT_DURATION: parseInt(process.env.LOCKOUT_DURATION || '900000'), // 15 minutes
  SESSION_CLEANUP_INTERVAL: process.env.SESSION_CLEANUP_INTERVAL || '0 0 * * *',
} as const;
