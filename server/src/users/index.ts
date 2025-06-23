// src/users/index.ts
// Main services
export { UsersService } from './users.service';
export { UsersController } from './users.controller';
export { UsersModule } from './users.module';

// Specialized services
export { UserService } from './services/user.service';
export { ProfileService } from './services/profile.service';
export { UserAnalyticsService } from './services/user-analytics.service';
export { UserQueryService } from './services/user-query.service';
// export { UserBulkService } from './services/user-bulk.service';

// DTOs
export * from './dto/create-user.dto';
export * from './dto/update-user.dto';
export * from './dto/profile-translation.dto';

// Types
export * from './types/user.types';
