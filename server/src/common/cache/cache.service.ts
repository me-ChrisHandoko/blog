import { Injectable } from '@nestjs/common';
import { LRUCache } from './lru-cache';
import { SafeUser } from 'src/users/types/user.types';

@Injectable()
export class CacheService {
  private readonly userCache = new LRUCache<string, SafeUser>(1000);
  private readonly translationCache = new LRUCache<string, string>(5000);

  async getUserFromCache(id: string): Promise<SafeUser | null> {
    return this.userCache.get(id) || null;
  }

  async setUserInCache(id: string, user: SafeUser): Promise<void> {
    this.userCache.set(id, user);
  }

  getCacheStats() {
    return {
      user: this.userCache.getMetrics(),
      translation: this.translationCache.getMetrics(),
    };
  }
}
