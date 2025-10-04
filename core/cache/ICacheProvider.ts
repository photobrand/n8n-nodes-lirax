import { createRequire } from 'module';
import type { CacheProviderOptions, CacheProviderType } from '../../types/LiraX.types.js';

const requireFn = createRequire(import.meta.url);

export interface ICacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<{ size: number; hits: number; misses: number }>;
}

export class MemoryCacheProvider implements ICacheProvider {
  private cache = new Map<string, { data: unknown; expires: number }>();
  private stats = { hits: 0, misses: 0 };
  private defaultTTL: number;
  private keyPrefix: string;

  constructor(options: CacheProviderOptions = {}) {
    this.defaultTTL = options.ttl ?? 3600;
    this.keyPrefix = options.keyPrefix ?? 'lirax';
  }

  private makeKey(key: string) {
    return `${this.keyPrefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(this.makeKey(key));
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(this.makeKey(key));
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTTL;
    const expires = ttl > 0 ? Date.now() + (ttl * 1000) : Number.MAX_SAFE_INTEGER;
    this.cache.set(this.makeKey(key), { data: value, expires });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(this.makeKey(key));
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  async getStats() {
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses
    };
  }
}

export class CacheFactory {
  private static logCacheFallback(from: string, to: string, reason: string) {
    console.warn(`[LiraX Cache] Falling back from ${from} to ${to}: ${reason}`);
  }

  static create(
    providerType: CacheProviderType = 'memory',
    options: CacheProviderOptions = {},
  ): ICacheProvider {
    switch (providerType) {
      case 'redis':
        return this.createRedisProvider(options);
      case 'file':
        return this.createFileProvider(options);
      case 'memory':
      default:
        return new MemoryCacheProvider(options);
    }
  }

  private static createRedisProvider(options: CacheProviderOptions): ICacheProvider {
    try {
      // Проверяем наличие ioredis и провайдера
      requireFn('ioredis');
      const { RedisCacheProvider } = requireFn('./RedisCache.js');
      return new RedisCacheProvider(options);
    } catch (e: unknown) {
      const error = e as { code?: string; message?: string };
      const reason = error?.code === 'MODULE_NOT_FOUND'
        ? 'ioredis not installed'
        : `init error: ${error?.message || 'unknown'}`;
      this.logCacheFallback('Redis', 'Memory', reason);
      return new MemoryCacheProvider(options);
    }
  }

  private static createFileProvider(options: CacheProviderOptions): ICacheProvider {
    try {
      const { FileCacheProvider } = requireFn('./FileCache.js');
      return new FileCacheProvider(options);
    } catch (e: unknown) {
      const error = e as { message?: string };
      this.logCacheFallback('File', 'Memory', `init error: ${error?.message || 'unknown'}`);
      return new MemoryCacheProvider(options);
    }
  }
}