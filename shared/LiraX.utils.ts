import {
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INode,
  IDataObject
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { createHash, timingSafeEqual } from 'crypto';

import type {
  LiraXCredentials,
  ValidationResult,
  PhoneValidationResult,
  LiraXWebhookPayload
} from '../types/LiraX.types';
import { LiraXErrorHandler } from '../core/LiraXErrorHandler';

/**
 * LiraX API Integration Utilities
 *
 * ВАЖНО: API LiraX v4.45 ТРЕБУЕТ передачу параметра `token` в теле запроса
 * application/x-www-form-urlencoded вместе с остальными параметрами.
 *
 * Авторизация работает двумя способами одновременно:
 * 1. Authorization: Bearer <token> - заголовок (для новых инсталляций)
 * 2. token=<value> - в теле формы (обязательно по спецификации)
 *
 * Все параметры сериализуются как строки:
 * - Числа: "123"
 * - Булевы: "0" или "1"
 * - Телефоны: нормализованы до цифр
 * - Даты: "YYYY-MM-DD HH:MM:SS"
 */

// ==================== КОНСТАНТЫ И ТИПЫ ====================

const SMS_THROTTLE_DELAY_MS = 5000; // 5 секунд между SMS запросами
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const CIRCUIT_BREAKER_RESET_TIMEOUT_MS = 60000;

interface ThrottleEntry {
  lastRequestTime: number;
  pending: Promise<unknown> | null;
}

// ==================== МЕНЕДЖЕР ТРОТТЛИНГА ====================

export class ThrottlingManager {
  private static instance: ThrottlingManager;
  private throttleMap: Map<string, ThrottleEntry> = new Map();

  private constructor() {}

  static getInstance(): ThrottlingManager {
    if (!ThrottlingManager.instance) {
      ThrottlingManager.instance = new ThrottlingManager();
    }
    return ThrottlingManager.instance;
  }

  async throttle<T>(
    key: string,
    operation: () => Promise<T>,
    delayMs: number = SMS_THROTTLE_DELAY_MS
  ): Promise<T> {
    const now = Date.now();
    const entry = this.throttleMap.get(key);

    if (entry && entry.pending) {
      // Ждем завершения текущего запроса
      await entry.pending;
    }

    if (entry && now - entry.lastRequestTime < delayMs) {
      const waitTime = delayMs - (now - entry.lastRequestTime);
      await this.delay(waitTime);
    }

    // Создаем новую запись
    const promise = operation();
    this.throttleMap.set(key, {
      lastRequestTime: Date.now(),
      pending: promise
    });

    try {
      const result = await promise;
      return result;
    } finally {
      // Очищаем pending статус
      const currentEntry = this.throttleMap.get(key);
      if (currentEntry?.pending === promise) {
        this.throttleMap.set(key, {
          ...currentEntry,
          pending: null
        });
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cleanup(): void {
    const now = Date.now();
    const CLEANUP_THRESHOLD_MS = 300000; // 5 минут

    for (const [key, entry] of this.throttleMap.entries()) {
      if (now - entry.lastRequestTime > CLEANUP_THRESHOLD_MS && !entry.pending) {
        this.throttleMap.delete(key);
      }
    }
  }
}

// ==================== ФАБРИКА CIRCUIT BREAKER ====================

export class CircuitBreakerFactory {
  private static breakers: Map<string, CircuitBreaker> = new Map();

  static getBreaker(credentialsId: string): CircuitBreaker {
    if (!this.breakers.has(credentialsId)) {
      this.breakers.set(credentialsId, new CircuitBreaker());
    }
    return this.breakers.get(credentialsId)!;
  }

  static cleanup(): void {
    const now = Date.now();
    const CLEANUP_THRESHOLD_MS = 3600000; // 1 час

    for (const [id, breaker] of this.breakers.entries()) {
      const stats = breaker.getStats();
      if (now - stats.lastFailureTime > CLEANUP_THRESHOLD_MS && stats.failures === 0) {
        this.breakers.delete(id);
      }
    }
  }
}

// ==================== УТИЛИТЫ ВАЛИДАЦИИ И ФОРМАТИРОВАНИЯ ====================

export const normalizePhoneDigits = (phone: string): string => {
  if (!phone || typeof phone !== 'string') {
    return '';
  }
  return phone.replace(/\D+/g, '');
};

export const validatePhoneNumber = (phone: string): PhoneValidationResult => {
  const normalized = normalizePhoneDigits(phone);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (normalized.length < 5) {
    errors.push('Phone number must contain at least 5 digits');
  }

  if (normalized.length > 20) {
    errors.push('Phone number too long (max 20 digits)');
  }

  if (!/^[0-9]+$/.test(normalized)) {
    errors.push('Phone number contains invalid characters after normalization');
  }

  if (normalized.startsWith('0')) {
    warnings.push('Phone number starts with 0 - ensure country code is included');
  }

  if (normalized.length === 10 && !normalized.startsWith('1')) {
    warnings.push('10-digit number detected - may need country code prefix');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized,
    original: phone,
  };
};

export const formatPhoneForDisplay = (phone: string): string => {
  const digits = normalizePhoneDigits(phone);

  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 12 && digits.startsWith('380')) {
    return `+380 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
  }

  return `+${digits}`;
};

export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  if (email.length > 254) {
    errors.push('Email address too long');
  }

  const [localPart, domain] = email.split('@');

  if (localPart && localPart.length > 64) {
    warnings.push('Email local part is unusually long');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

export const validateTimeWindow48h = (start: string, finish: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const startDate = new Date(start);
    const finishDate = new Date(finish);

    if (isNaN(startDate.getTime())) {
      errors.push('Invalid start date format');
    }

    if (isNaN(finishDate.getTime())) {
      errors.push('Invalid finish date format');
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    const diffMs = finishDate.getTime() - startDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours > 48) {
      errors.push('Time window cannot exceed 48 hours');
    }

    if (diffHours <= 0) {
      errors.push('Finish date must be after start date');
    }

    if (diffHours < 1) {
      warnings.push('Time window is less than 1 hour - consider expanding for better results');
    }

  } catch (error) {
    errors.push('Failed to parse dates');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

export const formatDateTimeSQL = (dateTime: string | Date): string => {
  let date: Date;

  if (typeof dateTime === 'string') {
    date = new Date(dateTime);
  } else {
    date = dateTime;
  }

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateTime}`);
  }

  const pad = (num: number): string => num.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const getCurrentSQLDateTime = (): string => {
  return formatDateTimeSQL(new Date());
};

// ==================== ОСНОВНЫЕ ФУНКЦИИ API ====================

const formEncode = (body: Record<string, unknown>): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(item => params.append(key, String(item)));
      } else {
        params.append(key, String(value));
      }
    }
  }

  return params.toString();
};

const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const calculateRetryDelay = (
  attempt: number,
  credentials: LiraXCredentials
): number => {
  const baseDelay = credentials.backoffBaseMs || 1000;

  // Экспоненциальная задержка с jitter по умолчанию
  const expDelay = baseDelay * Math.pow(2, attempt);
  const jitteredExp = expDelay * (0.8 + Math.random() * 0.4); // jitter 0.8-1.2
  return Math.min(jitteredExp, 30000); // Максимум 30 секунд
};

const isRetryableError = (error: unknown): boolean => {
  if (!error) return false;

  const errorObj = error as { code?: string; httpCode?: number; message?: string };

  // Сетевые ошибки
  if (errorObj.code === 'ETIMEDOUT' || errorObj.code === 'ECONNRESET' || errorObj.code === 'ECONNREFUSED') {
    return true;
  }

  // HTTP 5xx ошибки
  if (errorObj.httpCode && errorObj.httpCode >= 500 && errorObj.httpCode < 600) {
    return true;
  }

  // Rate limiting
  if (errorObj.httpCode === 429) {
    return true;
  }

  // Специфичные ошибки LiraX
  if (errorObj.message?.includes('modem busy') ||
      errorObj.message?.includes('timeout') ||
      errorObj.message?.includes('temporarily unavailable')) {
    return true;
  }

  return false;
};

export const liraxRequest = async (
  context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
  credentials: LiraXCredentials,
  payload: Record<string, unknown>,
  options: {
    useCache?: boolean;
    cacheKey?: string;
    cacheTTL?: number;
    signal?: AbortSignal;
    idempotencyKey?: string;
    bypassCircuitBreaker?: boolean;
    throttleKey?: string; // Ключ для троттлинга
  } = {}
): Promise<unknown> => {
  const {
    useCache = false,
    cacheKey,
    cacheTTL = 3600,
    signal,
    idempotencyKey,
    bypassCircuitBreaker = false,
    throttleKey
  } = options;

  // Если указан throttleKey, используем троттлинг
  if (throttleKey) {
    const throttlingManager = ThrottlingManager.getInstance();
    return await throttlingManager.throttle(throttleKey, async () => {
      return await executeLiraxRequest();
    });
  }

  return await executeLiraxRequest();

  async function executeLiraxRequest(): Promise<unknown> {
    // Используем Circuit Breaker, если не отключен
    if (!bypassCircuitBreaker) {
      const circuitBreaker = CircuitBreakerFactory.getBreaker(credentials.id || 'default');
      try {
        return await circuitBreaker.execute(async () => {
          return await executeRequestWithRetry();
        });
      } catch (error) {
        throw LiraXErrorHandler.handle(error as Error, {
          node: context.getNode(),
          operation: (payload as { cmd?: string }).cmd || 'unknown',
          payload,
          message: 'Circuit breaker blocked request due to repeated failures',
        });
      }
    }

    return await executeRequestWithRetry();
  }

  async function executeRequestWithRetry(): Promise<unknown> {
    const urls = [credentials.baseUrl];
    if (credentials.secondaryBaseUrl) {
      urls.push(credentials.secondaryBaseUrl);
    }

    const validUrls = urls.filter(url =>
      url && url.length > 5 && (url.startsWith('http://') || url.startsWith('https://'))
    );

    if (validUrls.length === 0) {
      throw LiraXErrorHandler.handle(
        new Error('No valid base URLs configured'),
        {
          node: context.getNode(),
          operation: (payload as { cmd?: string }).cmd || 'unknown',
          payload,
          message: 'LiraX API configuration error',
        }
      );
    }

    const allErrors: Error[] = [];

    for (const baseUrl of validUrls) {
      let attempt = 0;
      const maxAttempts = Math.max(0, credentials.retries || DEFAULT_RETRY_ATTEMPTS) + 1;

      while (attempt < maxAttempts) {
        try {
          if (signal?.aborted) {
            throw new Error('Request aborted by signal');
          }

          const url = `${baseUrl.replace(/\/+$/, '')}/general`;

          // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: добавляем token в тело запроса согласно спецификации API 4.45
          // Сохраняем также Authorization header для обратной совместимости
          const payloadWithToken = {
            ...payload,
            token: credentials.token, // Обязательный параметр по спецификации
          };

          const body = formEncode(payloadWithToken);

          const requestOptions: IHttpRequestOptions = {
            method: 'POST',
            url,
            body,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Bearer ${credentials.token}`, // Сохраняем для совместимости
              'User-Agent': 'n8n-nodes-lirax/1.0.0',
              'X-Request-ID': generateRequestId(),
              ...(idempotencyKey && { 'X-Idempotency-Key': idempotencyKey }),
            },
            timeout: credentials.timeoutMs || DEFAULT_TIMEOUT_MS,
            rejectUnauthorized: credentials.sslVerify !== false,
          };

          const response = await context.helpers.httpRequest(requestOptions);

          if (response && typeof response === 'object' && 'error' in response) {
            throw new Error(`LiraX API error: ${(response as { error: string }).error}`);
          }

          return response;

        } catch (error) {
          const typedError = error as Error;
          allErrors.push(typedError);

          if (!isRetryableError(error)) {
            break;
          }

          if (attempt === maxAttempts - 1) {
            break;
          }

          const delay = calculateRetryDelay(attempt, credentials);
          if (delay > 0) {
            await sleep(delay);
          }

          attempt++;
        }
      }
    }

    throw LiraXErrorHandler.handleFailoverError(allErrors, {
      node: context.getNode(),
      operation: (payload as { cmd?: string }).cmd || 'unknown',
      payload,
      message: `LiraX API request failed on all endpoints (${validUrls.length}) after all retries`,
    });
  }
};

// ==================== IDEMPOTENCY SERVICE ====================

export class IdempotencyService {
  private static cache: Map<string, { result: unknown; expiry: number }> = new Map();

  async executeWithIdempotency<T>(
    key: string,
    operation: () => Promise<T>,
    ttlSeconds: number = 86400
  ): Promise<{ result: T; fromCache: boolean }> {
    const now = Date.now();
    const cacheKey = `idempotency:${key}`;

    // Проверяем кэш
    const cached = IdempotencyService.cache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return { result: cached.result as T, fromCache: true };
    }

    // Выполняем операцию
    const result = await operation();

    // Сохраняем в кэш
    IdempotencyService.cache.set(cacheKey, {
      result,
      expiry: now + (ttlSeconds * 1000)
    });

    // Очистка устаревших записей
    this.cleanupExpired();

    return { result, fromCache: false };
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of IdempotencyService.cache.entries()) {
      if (entry.expiry <= now) {
        IdempotencyService.cache.delete(key);
      }
    }
  }

  static clear(): void {
    IdempotencyService.cache.clear();
  }
}

// ==================== BATCH PROCESSING ====================

export class BatchProcessor {
  static async processInBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[], batchIndex: number) => Promise<R[]>,
    delayBetweenBatchesMs: number = 1000
  ): Promise<R[]> {
    const results: R[] = [];
    const batches = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchResults = await processor(batch, i);
      results.push(...batchResults);

      if (delayBetweenBatchesMs > 0 && i < batches.length - 1) {
        await delay(delayBetweenBatchesMs);
      }
    }

    return results;
  }

  static async processWithRateLimit<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    rateLimit: { requests: number; perMilliseconds: number },
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];
    const batches = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchPromises = batch.map((item, index) => processor(item, i * batchSize + index));

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i < batches.length - 1) {
        await delay(rateLimit.perMilliseconds / rateLimit.requests);
      }
    }

    return results;
  }
}

// ==================== CIRCUIT BREAKER ====================

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenMaxAttempts: number;
  private halfOpenAttempts = 0;
  private successCount = 0;

  constructor(
    failureThreshold: number = 5,
    resetTimeout: number = CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
    halfOpenMaxAttempts: number = 3
  ) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN. Requests to LiraX API are temporarily blocked due to repeated failures.');
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
      throw new Error('Circuit breaker half-open attempts exceeded. Going back to OPEN state.');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.successCount++;

    if (this.state === 'HALF_OPEN' && this.successCount >= 3) {
      this.state = 'CLOSED';
      this.successCount = 0;
    } else if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempts++;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.halfOpenAttempts++;
    this.successCount = 0;

    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
    }
  }

  getState(): string {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      halfOpenAttempts: this.halfOpenAttempts,
      successCount: this.successCount
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

// ==================== WEBHOOK UTILITIES ====================

export const verifyWebhookToken = (
  incomingToken: string | undefined,
  expectedToken: string,
  context: IHookFunctions
): void => {
  if (!incomingToken) {
    const error = new Error('Missing webhook token');
    (error as { httpCode?: number }).httpCode = 401;
    throw error;
  }

  if (!expectedToken) {
    const error = new Error('Webhook token not configured in credentials');
    (error as { httpCode?: number }).httpCode = 401;
    throw error;
  }

  // ✅ ИСПРАВЛЕНО: Используем timingSafeEqual для предотвращения timing attacks
  try {
    const incomingBuffer = Buffer.from(incomingToken);
    const expectedBuffer = Buffer.from(expectedToken);

    if (incomingBuffer.length !== expectedBuffer.length) {
      const error = new Error('Invalid webhook token');
      (error as { httpCode?: number }).httpCode = 401;
      throw error;
    }

    if (!timingSafeEqual(incomingBuffer, expectedBuffer)) {
      const error = new Error('Invalid webhook token');
      (error as { httpCode?: number }).httpCode = 401;
      throw error;
    }
  } catch (error) {
    // Если timingSafeEqual fails, это означает токены не совпадают
    const authError = new Error('Invalid webhook token');
    (authError as { httpCode?: number }).httpCode = 401;
    throw authError;
  }
};

export const parseWebhookBody = (bodyData: unknown): Record<string, unknown> => {
  if (typeof bodyData === 'object' && bodyData !== null) {
    return bodyData as Record<string, unknown>;
  }

  if (typeof bodyData === 'string') {
    try {
      return JSON.parse(bodyData);
    } catch {
      try {
        const params = new URLSearchParams(bodyData);
        const result: Record<string, string> = {};
        for (const [key, value] of params) {
          result[key] = value;
        }
        return result;
      } catch {
        return { raw: bodyData };
      }
    }
  }

  return { raw: bodyData };
};

// ==================== УТИЛИТЫ ====================

const generateRequestId = (): string => {
  return `lirax_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const sanitizePhoneForLog = (phone: string): string => {
  const digits = normalizePhoneDigits(phone);
  if (digits.length <= 4) {
    return digits;
  }
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const validateRequiredParameters = (
  params: Record<string, unknown>,
  required: string[]
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const param of required) {
    if (params[param] === undefined || params[param] === null || params[param] === '') {
      errors.push(`Missing required parameter: ${param}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

export const validateNumericRange = (
  value: number,
  min: number,
  max: number,
  paramName: string
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (value < min) {
    errors.push(`${paramName} must be at least ${min}`);
  }

  if (value > max) {
    errors.push(`${paramName} must be at most ${max}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

export const generateIdempotencyKey = (executionId: string, itemIndex: number): string => {
  return `${executionId}-${itemIndex}-${Date.now()}`;
};

export const maskSensitiveData = (data: IDataObject): IDataObject => {
  const masked = { ...data };

  const sensitiveFields = ['token', 'phone', 'ani', 'dnis', 'to', 'to1', 'to2', 'email', 'password'];

  sensitiveFields.forEach(field => {
    if (masked[field]) {
      const value = String(masked[field]);
      if (value.length > 4) {
        masked[field] = `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
      } else {
        masked[field] = '****';
      }
    }
  });

  return masked;
};

export const validateWebhookPayload = (payload: unknown): LiraXWebhookPayload => {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid webhook payload: expected object');
  }

  const webhookPayload = payload as LiraXWebhookPayload;

  if (!webhookPayload.cmd) {
    throw new Error('Invalid webhook payload: missing cmd field');
  }

  return webhookPayload;
};

export const createHealthCheckPayload = (): Record<string, unknown> => {
  return {
    cmd: 'getShops',
    health_check: true,
    timestamp: new Date().toISOString(),
  };
};

export const isHealthCheckSuccessful = (response: unknown): boolean => {
  if (typeof response !== 'object' || response === null) {
    return false;
  }

  const responseObj = response as Record<string, unknown>;

  return !('error' in responseObj) && ('shops' in responseObj || 'users' in responseObj);
};

// Утилита для создания ключа троттлинга SMS
export const createSMSThrottleKey = (provider: string, ext: string): string => {
  return `sms:${provider}:${ext}`;
};

// Функция для SMS операций с троттлингом
export const throttledSMSRequest = async (
  context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
  credentials: LiraXCredentials,
  payload: Record<string, unknown>,
  provider: string,
  ext: string,
  options: Record<string, unknown> = {}
): Promise<unknown> => {
  const throttleKey = createSMSThrottleKey(provider, ext);
  return await liraxRequest(context, credentials, payload, {
    ...options,
    throttleKey
  });
};

export { LiraXErrorHandler };

// ✅ ДОБАВЛЕНА ФУНКЦИЯ ДЛЯ ЗАЩИТЫ ОТ SSRF АТАК
export function validatePublicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    // Блокируем RFC1918 и link-local
    const privateCidrs = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^169\.254\./];
    if (privateCidrs.some((r) => r.test(host))) return false;
    return true;
  } catch {
    return false;
  }
}