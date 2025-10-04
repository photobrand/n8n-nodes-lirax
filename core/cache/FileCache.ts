import fs from 'fs/promises';
import path from 'path';
import type { ICacheProvider } from './ICacheProvider.js';
import type { CacheProviderOptions } from '../../types/LiraX.types.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

export class FileCacheProvider implements ICacheProvider {
  private cacheDir: string;
  private defaultTTL: number;
  private keyPrefix: string;
  private stats = { hits: 0, misses: 0 };

  constructor(options: CacheProviderOptions = {}) {
    this.cacheDir = options.fileCachePath || '/tmp/n8n-lirax-cache';
    this.defaultTTL = options.ttl || 3600;
    this.keyPrefix = options.keyPrefix || 'lirax';

    // Создаём директорию при инициализации
    this.ensureDir().catch((error: unknown) => {
      console.warn('[LiraX Cache] Failed to create cache directory:', (error as Error).message);
    });
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code !== 'EEXIST') {
        throw new Error(`Cannot create cache directory ${this.cacheDir}: ${(error as Error).message}`);
      }
    }
  }

  private makeFilePath(key: string): string {
    // Безопасное имя файла (заменяем спецсимволы)
    const safeKey = `${this.keyPrefix}_${key}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.makeFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);

      // Проверяем истечение TTL
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry.value;
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code !== 'ENOENT') {
        console.warn('[LiraX Cache] File read error:', (error as Error).message);
      }
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.ensureDir();

      const ttl = ttlSeconds ?? this.defaultTTL;
      const expiresAt = ttl > 0 ? Date.now() + (ttl * 1000) : null;

      const entry: CacheEntry<T> = { value, expiresAt };
      const filePath = this.makeFilePath(key);

      await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
    } catch (error: unknown) {
      console.warn('[LiraX Cache] File write error:', (error as Error).message);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.makeFilePath(key);
      await fs.unlink(filePath);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code !== 'ENOENT') {
        console.warn('[LiraX Cache] File delete error:', (error as Error).message);
      }
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const prefix = `${this.keyPrefix}_`;

      await Promise.all(
        files
          .filter(file => file.startsWith(prefix) && file.endsWith('.json'))
          .map(file => fs.unlink(path.join(this.cacheDir, file)).catch(() => {}))
      );
    } catch (error: unknown) {
      console.warn('[LiraX Cache] Clear error:', (error as Error).message);
    }
  }

  async getStats() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const prefix = `${this.keyPrefix}_`;
      const size = files.filter(f => f.startsWith(prefix) && f.endsWith('.json')).length;

      return {
        size,
        hits: this.stats.hits,
        misses: this.stats.misses,
      };
    } catch {
      return {
        size: 0,
        hits: this.stats.hits,
        misses: this.stats.misses,
      };
    }
  }
}