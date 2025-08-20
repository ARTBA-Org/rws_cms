export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryCondition?: (error: Error) => boolean;
}

export class RetryableError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'RetryableError';
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    backoffFactor = 2,
    retryCondition = (error) => true,
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      if (!retryCondition(lastError)) {
        throw lastError;
      }
      
      const delayMs = Math.min(
        baseDelayMs * Math.pow(backoffFactor, attempt),
        maxDelayMs
      );
      
      console.warn(
        `Attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}. Retrying in ${delayMs}ms...`
      );
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError!;
}

export function isRetryableOpenAIError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'rate limit',
    'timeout',
    'network error',
    'connection error',
    'service unavailable',
    'internal server error',
    'bad gateway',
    'gateway timeout',
    'temporary failure',
  ];
  
  return retryablePatterns.some(pattern => message.includes(pattern));
}

export function isRetryablePuppeteerError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'target closed',
    'navigation timeout',
    'protocol error',
    'connection refused',
    'net::err_',
    'timeout',
  ];
  
  return retryablePatterns.some(pattern => message.includes(pattern));
}