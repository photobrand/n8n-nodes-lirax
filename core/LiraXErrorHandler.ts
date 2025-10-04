import { NodeApiError, INode, IDataObject } from 'n8n-workflow';

export interface ErrorContext {
  node: INode;
  operation: string;
  payload?: IDataObject;
  message?: string;
  resource?: string;
}

export class LiraXErrorHandler {
  public static handle(error: unknown, context: ErrorContext): NodeApiError {
    // Очищаем токен из payload для безопасности
    const sanitizedPayload = context.payload ? { ...context.payload } : {};
    if (sanitizedPayload.token) {
      delete sanitizedPayload.token;
    }

    const details: IDataObject = {
      operation: context.operation,
      resource: context.resource,
      timestamp: new Date().toISOString(),
    };

    if (sanitizedPayload && Object.keys(sanitizedPayload).length > 0) {
      details.requestPayload = this.maskSensitiveData(sanitizedPayload);
    }

    // Извлекаем HTTP код и тело ответа, если есть
    const httpCode = (error as any).httpCode || (error as any).response?.status;
    const responseBody = (error as any).response?.body || (error as any).response?.data;

    if (httpCode) {
      details.httpCode = httpCode;
    }

    if (responseBody) {
      details.responseBody = typeof responseBody === 'string'
        ? responseBody
        : JSON.stringify(responseBody);
    }

    // Добавляем информацию о сетевой ошибке
    if ((error as any).code) {
      details.errorCode = (error as any).code;
    }

    // Генерируем понятное сообщение об ошибке
    const userFriendlyMessage = this.generateUserFriendlyMessage(error, context.operation, httpCode);

    return new NodeApiError(context.node, error as Error, {
      message: userFriendlyMessage,
      description: this.formatErrorDescription(details),
    });
  }

  private static generateUserFriendlyMessage(error: unknown, operation: string, httpCode?: number): string {
    const errorObj = error as any;
    
    // Обработка специфичных ошибок LiraX
    if (httpCode === 401) {
      return `Operation '${operation}' failed: Invalid LiraX API Token. Check your credentials.`;
    }

    if (httpCode === 400) {
      return `Operation '${operation}' failed: Invalid parameters sent to LiraX. Check node inputs and validation.`;
    }

    if (httpCode === 403) {
      if (errorObj.message?.includes('modem busy')) {
        return `Operation '${operation}' failed: LiraX modem is busy. Please try again later.`;
      }
      return `Operation '${operation}' failed: Access forbidden. Check your permissions.`;
    }

    if (httpCode === 404) {
      return `Operation '${operation}' failed: Resource not found. Check if the operation exists in your LiraX version.`;
    }

    if (httpCode === 500) {
      return `Operation '${operation}' failed: LiraX server internal error.`;
    }

    if (httpCode === 502) {
      return `Operation '${operation}' failed: LiraX server is temporarily unavailable.`;
    }

    if (httpCode === 503) {
      return `Operation '${operation}' failed: LiraX service is temporarily overloaded.`;
    }

    // Обработка сетевых ошибок
    if (errorObj.code === 'ETIMEDOUT') {
      return `Operation '${operation}' failed: Connection to LiraX timed out.`;
    }

    if (errorObj.code === 'ECONNREFUSED') {
      return `Operation '${operation}' failed: Connection to LiraX refused. Check base URL and network connectivity.`;
    }

    if (errorObj.code === 'ENOTFOUND') {
      return `Operation '${operation}' failed: LiraX server not found. Check base URL.`;
    }

    if (errorObj.code === 'ECONNRESET') {
      return `Operation '${operation}' failed: Connection to LiraX was reset.`;
    }

    // Обработка ошибок валидации Zod
    if (errorObj.errors && Array.isArray(errorObj.errors) && errorObj.errors[0]?.path) {
      const fieldErrors = errorObj.errors.map((err: any) =>
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return `Operation '${operation}' failed: Invalid input parameters. ${fieldErrors}`;
    }

    // Обработка ошибок от LiraX API
    if (errorObj.response?.data?.error) {
      return `Operation '${operation}' failed: ${errorObj.response.data.error}`;
    }

    if (errorObj.message?.includes('modem busy')) {
      return `Operation '${operation}' failed: LiraX modem is busy. Please try again later.`;
    }

    // Общий случай
    return `Operation '${operation}' failed: ${errorObj.message || 'Unknown error occurred'}`;
  }

  private static maskSensitiveData(payload: IDataObject): IDataObject {
    const masked = { ...payload };

    // Маскируем чувствительные данные для логов
    const sensitiveFields = ['token', 'phone', 'ani', 'dnis', 'to', 'to1', 'to2',
  'provider', 'ext', 'newext', 'client', 'from_LiraX_token'];

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
  }

  private static formatErrorDescription(details: IDataObject): string {
    const lines = ['LiraX API Error Details:'];

    if (details.operation) {
      lines.push(`Operation: ${details.operation}`);
    }

    if (details.resource) {
      lines.push(`Resource: ${details.resource}`);
    }

    if (details.httpCode) {
      lines.push(`HTTP Code: ${details.httpCode}`);
    }

    if (details.errorCode) {
      lines.push(`Error Code: ${details.errorCode}`);
    }

    if (details.timestamp) {
      lines.push(`Timestamp: ${details.timestamp}`);
    }

    if (details.requestPayload) {
      lines.push('', 'Request Payload (sensitive data masked):');
      lines.push(JSON.stringify(details.requestPayload, null, 2));
    }

    if (details.responseBody) {
      lines.push('', 'Response Body:');
      if (typeof details.responseBody === 'string') {
        try {
          const parsed = JSON.parse(details.responseBody);
          lines.push(JSON.stringify(parsed, null, 2));
        } catch {
          lines.push(details.responseBody);
        }
      } else {
        lines.push(JSON.stringify(details.responseBody, null, 2));
      }
    }

    return lines.join('\n');
  }

  // Метод для обработки ошибок валидации Zod
  public static handleValidationError(error: any, context: ErrorContext): NodeApiError {
    const validationErrors = error.errors.map((err: any) =>
      `Field '${err.path.join('.')}': ${err.message}`
    ).join('; ');

    const details: IDataObject = {
      operation: context.operation,
      resource: context.resource,
      timestamp: new Date().toISOString(),
      validationErrors: error.errors,
    };

    return new NodeApiError(context.node, error, {
      message: `Validation failed for operation '${context.operation}': ${validationErrors}`,
      description: this.formatErrorDescription(details),
    });
  }

  // Метод для обработки ошибок кэша
  public static handleCacheError(error: any, context: ErrorContext): NodeApiError {
    const details: IDataObject = {
      operation: context.operation,
      resource: context.resource,
      timestamp: new Date().toISOString(),
      cacheError: true,
    };

    return new NodeApiError(context.node, error, {
      message: `Cache operation failed for '${context.operation}'`,
      description: this.formatErrorDescription(details),
    });
  }

  // Метод для обработки ошибок отказоустойчивости
  public static handleFailoverError(errors: Error[], context: ErrorContext): NodeApiError {
    const details: IDataObject = {
      operation: context.operation,
      resource: context.resource,
      timestamp: new Date().toISOString(),
      failoverAttempts: errors.length,
      errors: errors.map((err, index) => ({
        attempt: index + 1,
        message: err.message,
        code: (err as any).code,
      })),
    };

    return new NodeApiError(context.node, errors[errors.length - 1], {
      message: `All failover attempts failed for operation '${context.operation}'`,
      description: this.formatErrorDescription(details),
    });
  }
}