// src/users/users.module.ts
import { Module } from '@nestjs/common';

import { UserService } from './services/user.service';
import { ProfileService } from './services/profile.service';
import { UserAnalyticsService } from './services/user-analytics.service';
import { UserQueryService } from './services/user-query.service';
// import { UserBulkService } from './services/user-bulk.service';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

import { DatabaseModule } from '../database/database.module';
import { AppI18nModule } from '../i18n/i18n.module';

@Module({
  imports: [DatabaseModule, AppI18nModule],
  providers: [
    UserService,
    ProfileService,
    UserAnalyticsService,
    UserQueryService,
    // UserBulkService,
    UsersService,
  ],
  controllers: [UsersController],
  exports: [
    UserService,
    ProfileService,
    UserAnalyticsService,
    UserQueryService,
    // UserBulkService,
    UsersService,
  ],
})
export class UsersModule {}
