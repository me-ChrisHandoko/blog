// src/bootstrap/app-factory.ts
import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../app.module';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { EnvConfig } from '../config/env.utils';
import { Logger } from '@nestjs/common';

export class AppFactory {
  private static readonly logger = new Logger('AppFactory');

  static async createApp(): Promise<NestFastifyApplication> {
    try {
      const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter({
          logger: false,
          trustProxy: true,
          disableRequestLogging: true,
          maxParamLength: 500,
          bodyLimit: 10485760,
        }),
        {
          bufferLogs: true,
          abortOnError: false,
        },
      );

      const configService =
        app.get<ConfigService<EnvironmentVariables>>(ConfigService);
      EnvConfig.initialize(configService);

      this.logger.log('✅ NestJS application created successfully');
      return app;
    } catch (error) {
      this.logger.error('❌ Failed to create NestJS application:', error);
      throw error;
    }
  }

  static getAppServices(app: NestFastifyApplication) {
    const reflector = app.get(Reflector);
    const configService =
      app.get<ConfigService<EnvironmentVariables>>(ConfigService);

    return { reflector, configService };
  }
}
