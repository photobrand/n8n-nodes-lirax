import { createRequire } from 'module';
import type { ICacheProvider } from './ICacheProvider.js';
import type { CacheProviderOptions } from '../../types/LiraX.types.js';

const requireFn = createRequire(import.meta.url);

interface IRedisClient {
  connect: () => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<'OK' | null>;
  setex: (key: string, seconds: number, value: string) => Promise<'OK' | null>;
  del: (...keys: string[]) => Promise<number>;
  scan: (cursor: string, ...args: string[]) => Promise<[string, string[]]>;
  quit: () => Promise<'OK' | null>;
  on: (event: 'connect' | 'error' | 'close', listener: (...args: unknown[]) => void) => void;
}

export class RedisCacheProvider implements ICacheProvider {
  private client: IRedisClient;
  private stats = { hits: 0, misses: 0 };
  private defaultTTL: number;
  private keyPrefix: string;
  private isConnected: boolean = false;
  private connectPromise: Promise<void> | null = null;

  constructor(options: CacheProviderOptions = {}) {
    this.defaultTTL = options.ttl || 3600;
    this.keyPrefix = options.keyPrefix || 'lirax';

    // Динамический импорт ioredis
    const Redis = requireFn('ioredis');

    // Формируем конфигурацию подключения
    const redisConfig: Record<string, unknown> = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    };

    // TLS конфигурация
    if (options.redisTls) {
      redisConfig.tls = {
        rejectUnauthorized: true,
      };
    }

    // Пароль и БД
    if (options.redisPassword) {
      redisConfig.password = options.redisPassword;
    }
    if (options.redisDb !== undefined) {
      redisConfig.db = options.redisDb;
    }

    // Создаём клиент
    const url = options.redisUrl || process.env.LIRAX_REDIS_URL || 'redis://localhost:6379';
    this.client = new (Redis as any)(url, redisConfig) as IRedisClient;

    // Обработчики событий
    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('[LiraX Cache] Redis connected successfully');
    });

    this.client.on('error', (error: Error) => {
      console.warn('[LiraX Cache] Redis error:', error.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });
  }

  private makeKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  private async ensureConnected(): Promise<void> {
    if (this.isConnected) return;
    if (!this.connectPromise) {
      this.connectPromise = this.client.connect().catch((e: unknown) => {
        this.connectPromise = null;
        throw e;
      });
    }
    await this.connectPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnected();

      const prefixedKey = this.makeKey(key);
      const data = await this.client.get(prefixedKey);

      if (!data) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(data) as T;
    } catch (error) {
      console.warn('[LiraX Cache] Redis get error:', (error as Error).message ?? error);
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.ensureConnected();

      const prefixedKey = this.makeKey(key);
      const ttl = ttlSeconds ?? this.defaultTTL;
      const serialized = JSON.stringify(value);

      if (ttl > 0) {
        await this.client.setex(prefixedKey, ttl, serialized);
      } else {
        await this.client.set(prefixedKey, serialized);
      }
    } catch (error) {
      console.warn('[LiraX Cache] Redis set error:', (error as Error).message ?? error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.ensureConnected();
      await this.client.del(this.makeKey(key));
    } catch (error) {
      console.warn('[LiraX Cache] Redis delete error:', (error as Error).message ?? error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.ensureConnected();

      const pattern = `${this.keyPrefix}:*`;
      let cursor = '0';

      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', '1000');
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
        cursor = next;
      } while (cursor !== '0');
    } catch (error) {
      console.warn('[LiraX Cache] Redis clear error:', (error as Error).message ?? error);
    }
  }

  async getStats() {
    return {
      size: 0,
      hits: this.stats.hits,
      misses: this.stats.misses,
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}