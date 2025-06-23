// src/main.ts
import { Logger } from '@nestjs/common';
import { AppFactory } from './bootstrap/app-factory';
import { SecuritySetup } from './bootstrap/security-setup';
import { MiddlewareSetup } from './bootstrap/middleware-setup';
import { StartupLogger } from './bootstrap/startup-logger';
import { LanguageService } from './i18n/services/language.service';
import { EnvConfig } from './config/env.utils';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await AppFactory.createApp();
    const { reflector } = AppFactory.getAppServices(app);
    const languageService = app.get(LanguageService);

    await SecuritySetup.configure(app);
    MiddlewareSetup.configure(app, reflector, languageService);

    const host = EnvConfig.isProduction() ? '0.0.0.0' : 'localhost';
    const port = EnvConfig.PORT;

    await app.listen(port, host);
    StartupLogger.logStartup(host, port);
  } catch (error) {
    StartupLogger.logStartupError(error);
    process.exit(1);
  }
}

function setupGracefulShutdown() {
  const shutdownLogger = new Logger('Shutdown');

  process.on('SIGTERM', () => {
    StartupLogger.logShutdown('SIGTERM');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    StartupLogger.logShutdown('SIGINT');
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    shutdownLogger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    shutdownLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

setupGracefulShutdown();
bootstrap();
