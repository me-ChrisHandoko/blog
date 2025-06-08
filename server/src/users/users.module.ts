// src/users/users.module.ts - Create this file
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService], // Export for use in other modules and tests
})
export class UsersModule {}
