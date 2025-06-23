// src/users/users.module.ts - UPDATED FOR COMPOSITION PATTERN
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
// ✅ Import all required services for composition
import { PrismaService } from '../database/prisma.service';
import { EnhancedPrismaService } from '../database/enhanced-prisma.service';
import { QueryOptimizerService } from '../database/query-optimizer.service';
import { LanguageService } from '../i18n/services/language.service';

@Module({
  providers: [
    UsersService,
    // ✅ Provide both Prisma services for composition
    PrismaService,
    EnhancedPrismaService,
    QueryOptimizerService,
    LanguageService,
  ],
  controllers: [UsersController],
  exports: [
    UsersService,
    // ✅ Export services for use in other modules
    PrismaService,
    EnhancedPrismaService,
    QueryOptimizerService,
  ],
})
export class UsersModule {}
