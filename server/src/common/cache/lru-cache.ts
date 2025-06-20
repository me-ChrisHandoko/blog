// src/common/cache/lru-cache.ts
export interface CacheEntry<T> {
  value: T;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  size: number;
  maxSize: number;
  memoryEstimate: string;
  oldestEntry?: number;
  newestEntry?: number;
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private metrics: Omit<
    CacheMetrics,
    'hitRate' | 'memoryEstimate' | 'oldestEntry' | 'newestEntry'
  >;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.metrics = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      size: 0,
      maxSize: this.maxSize,
    };
  }

  /**
   * Get value from cache and mark as recently used
   */
  get(key: K): V | undefined {
    this.metrics.totalRequests++;

    const entry = this.cache.get(key);
    if (entry) {
      // Cache hit - update access info and move to end (most recently used)
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      this.cache.delete(key);
      this.cache.set(key, entry);

      this.metrics.hits++;
      return entry.value;
    }

    // Cache miss
    this.metrics.misses++;
    return undefined;
  }

  /**
   * Set value in cache with LRU eviction
   */
  set(key: K, value: V): void {
    const now = Date.now();

    if (this.cache.has(key)) {
      // Update existing entry
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.lastAccessed = now;
      entry.accessCount++;

      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
    } else {
      // New entry - check if we need to evict
      if (this.cache.size >= this.maxSize) {
        // Remove least recently used (first item)
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      // Add new entry
      const newEntry: CacheEntry<V> = {
        value,
        accessCount: 1,
        lastAccessed: now,
        createdAt: now,
      };

      this.cache.set(key, newEntry);
    }

    this.metrics.size = this.cache.size;
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete specific key
   */
  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.metrics.size = 0;
    // Keep hit/miss stats for analytics
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache metrics and analytics
   */
  getMetrics(): CacheMetrics {
    const hitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.hits / this.metrics.totalRequests) * 100
        : 0;

    // Calculate memory estimate (rough approximation)
    const avgKeySize = 50; // bytes
    const avgValueSize = 100; // bytes
    const avgEntryOverhead = 50; // object overhead
    const totalBytes =
      this.cache.size * (avgKeySize + avgValueSize + avgEntryOverhead);
    const memoryEstimate = this.formatBytes(totalBytes);

    // Get oldest and newest entry timestamps
    let oldestEntry: number | undefined;
    let newestEntry: number | undefined;

    if (this.cache.size > 0) {
      const entries = Array.from(this.cache.values());
      const createdTimes = entries.map((entry) => entry.createdAt);
      oldestEntry = Math.min(...createdTimes);
      newestEntry = Math.max(...createdTimes);
    }

    return {
      ...this.metrics,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryEstimate,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Get most accessed entries
   */
  getMostAccessed(
    limit: number = 10,
  ): Array<{ key: K; value: V; accessCount: number }> {
    const entries = Array.from(this.cache.entries());
    return entries
      .sort(([, a], [, b]) => b.accessCount - a.accessCount)
      .slice(0, limit)
      .map(([key, entry]) => ({
        key,
        value: entry.value,
        accessCount: entry.accessCount,
      }));
  }

  /**
   * Get least accessed entries
   */
  getLeastAccessed(
    limit: number = 10,
  ): Array<{ key: K; value: V; accessCount: number }> {
    const entries = Array.from(this.cache.entries());
    return entries
      .sort(([, a], [, b]) => a.accessCount - b.accessCount)
      .slice(0, limit)
      .map(([key, entry]) => ({
        key,
        value: entry.value,
        accessCount: entry.accessCount,
      }));
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Export cache data for debugging
   */
  exportData(): Array<{
    key: K;
    value: V;
    accessCount: number;
    lastAccessed: Date;
    createdAt: Date;
    ageInMinutes: number;
  }> {
    const now = Date.now();
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      accessCount: entry.accessCount,
      lastAccessed: new Date(entry.lastAccessed),
      createdAt: new Date(entry.createdAt),
      ageInMinutes: Math.round((now - entry.createdAt) / 60000),
    }));
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}
