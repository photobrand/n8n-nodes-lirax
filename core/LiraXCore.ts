import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  IDataObject
} from 'n8n-workflow';

import type { LiraXCredentials, CacheProviderType, CacheProviderOptions } from '../types/LiraX.types';
import { liraxRequest } from '../shared/LiraX.utils';
import { SchemaRegistry } from '../shared/schemas';
import { ICacheProvider, CacheFactory } from './cache/ICacheProvider';

export class LiraXCore {
  private readonly cache: ICacheProvider;
  private readonly credentials: LiraXCredentials;
  private readonly context: IExecuteFunctions | ILoadOptionsFunctions;

  constructor(context: IExecuteFunctions | ILoadOptionsFunctions, credentials: LiraXCredentials) {
    this.context = context;
    this.credentials = credentials;

    // Инициализация кэша с параметрами из ноды и env
    let provider: CacheProviderType = 'memory';
    let options: CacheProviderOptions = {};

    try {
      // Пытаемся получить параметры из ноды (если это execute context)
      if ('getNodeParameter' in context) {
        const performanceSettings = (context as IExecuteFunctions).getNodeParameter('performanceSettings', 0, {}) as IDataObject;

        provider = (performanceSettings?.cacheProvider as CacheProviderType) ||
                  (process.env.LIRAX_CACHE_PROVIDER as CacheProviderType) ||
                  'memory';

        options = {
          redisUrl: (performanceSettings?.redisUrl as string) || process.env.LIRAX_REDIS_URL,
          redisTls: performanceSettings?.redisTls as boolean ?? (process.env.LIRAX_REDIS_TLS === 'true'),
          redisPassword: process.env.LIRAX_REDIS_PASSWORD,
          redisDb: process.env.LIRAX_REDIS_DB ? parseInt(process.env.LIRAX_REDIS_DB, 10) : undefined,
          fileCachePath: (performanceSettings?.fileCachePath as string) || process.env.LIRAX_FILE_CACHE_PATH || '/tmp/n8n-lirax-cache',
          ttl: Number(performanceSettings?.cacheTTL ?? process.env.LIRAX_CACHE_TTL ?? 3600),
          keyPrefix: (performanceSettings?.cacheKeyPrefix as string) || process.env.LIRAX_CACHE_PREFIX || 'lirax',
        };
      } else {
        // Для loadOptions context используем только env переменные
        provider = (process.env.LIRAX_CACHE_PROVIDER as CacheProviderType) || 'memory';
        options = {
          redisUrl: process.env.LIRAX_REDIS_URL,
          redisTls: process.env.LIRAX_REDIS_TLS === 'true',
          redisPassword: process.env.LIRAX_REDIS_PASSWORD,
          redisDb: process.env.LIRAX_REDIS_DB ? parseInt(process.env.LIRAX_REDIS_DB, 10) : undefined,
          fileCachePath: process.env.LIRAX_FILE_CACHE_PATH || '/tmp/n8n-lirax-cache',
          ttl: Number(process.env.LIRAX_CACHE_TTL ?? 3600),
          keyPrefix: process.env.LIRAX_CACHE_PREFIX || 'lirax',
        };
      }
    } catch (error) {
      // Fallback на значения по умолчанию при любой ошибке
      console.warn('[LiraX Core] Failed to read cache settings, using defaults:', (error as Error).message);
      provider = 'memory';
      options = {
        ttl: 3600,
        keyPrefix: 'lirax'
      };
    }

    this.cache = CacheFactory.create(provider, options);
  }

  public async executeOperation(operation: string, params: IDataObject, options: {
    idempotencyKey?: string;
    idempotencyTTL?: number;
    useCache?: boolean;
    cacheKey?: string;
    cacheTTL?: number;
  } = {}): Promise<IDataObject> {
    const {
      idempotencyKey,
      idempotencyTTL = 86400,
      useCache = false,
      cacheKey,
      cacheTTL = 3600
    } = options;

    if (useCache && cacheKey) {
      const cached = await this.cache.get<IDataObject>(cacheKey);
      if (cached) {
        return { ...cached, _meta: { fromCache: true } };
      }
    }

    if (idempotencyKey) {
      const cachedResult = await this.cache.get<IDataObject>(`idempotency:${idempotencyKey}`);
      if (cachedResult) {
        return { ...cachedResult, _meta: { fromCache: true, idempotencyHit: true } };
      }
    }

    const schema = SchemaRegistry.getSchema(operation);
    const validatedParams = schema.parse(params);

    const payload = { ...validatedParams, cmd: operation };
    const result = await liraxRequest(this.context, this.credentials, payload);

    if (useCache && cacheKey) {
      await this.cache.set(cacheKey, result, cacheTTL);
    }

    if (idempotencyKey) {
      await this.cache.set(`idempotency:${idempotencyKey}`, result, idempotencyTTL);
    }

    return result as IDataObject;
  }

  public async getUsers(filter?: string): Promise<IDataObject[]> {
    const cacheKey = `users:${filter || 'all'}`;
    const result = await this.executeOperation('getUsers', {}, {
      useCache: true,
      cacheKey,
      cacheTTL: 3600
    });

    const users = (result.users || []) as IDataObject[];
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      return users.filter(user =>
        user.Name?.toString().toLowerCase().includes(lowerFilter) ||
        user.ext?.toString().includes(filter)
      );
    }
    return users;
  }

  public async getShops(filter?: string): Promise<IDataObject[]> {
    const cacheKey = `shops:${filter || 'all'}`;
    const result = await this.executeOperation('getShops', {}, {
      useCache: true,
      cacheKey,
      cacheTTL: 3600
    });

    const shops = (result.shops || []) as IDataObject[];
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      return shops.filter(shop =>
        shop.name?.toString().toLowerCase().includes(lowerFilter) ||
        shop.id?.toString().includes(filter)
      );
    }
    return shops;
  }

  public async getStages(filter?: string): Promise<IDataObject[]> {
    const cacheKey = `stages:${filter || 'all'}`;
    const result = await this.executeOperation('getStages', {}, {
      useCache: true,
      cacheKey,
      cacheTTL: 3600
    });

    const stages = (result.stages || []) as IDataObject[];
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      return stages.filter(stage =>
        stage.title?.toString().toLowerCase().includes(lowerFilter) ||
        stage.stage?.toString().includes(filter)
      );
    }
    return stages;
  }

  public async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  public async getCacheStats() {
    return await this.cache.getStats();
  }
}