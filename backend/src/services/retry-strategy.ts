/**
 * Retry Strategy Service
 * Implements exponential backoff retry logic for external API calls
 * Prevents temporary failures from causing permanent errors
 */

import { log } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (network, timeout, 5xx)
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') {
    return true;
  }

  // Timeout
  if (error?.message?.includes('timeout') || error?.message?.includes('TIMEOUT')) {
    return true;
  }

  // 5xx server errors
  if (error?.status >= 500 && error?.status < 600) {
    return true;
  }

  // Twilio specific errors
  if (error?.status === 429) {
    return true; // Rate limited - retry with backoff
  }

  return false;
}

/**
 * Execute function with exponential backoff retry
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function call
 * @throws Error after max attempts or if not retryable
 *
 * @example
 * ```typescript
 * const result = await withRetry(() => twilio.messages.create(...), {
 *   maxAttempts: 3,
 *   initialDelayMs: 1000
 * });
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === config.maxAttempts;
      const isRetryable = isRetryableError(error);

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      );

      log.warn('Retry', `Attempt ${attempt}/${config.maxAttempts} failed, retrying in ${delay}ms`, {
        error: error?.message,
        attempt,
        delay
      });

      await sleep(delay);
    }
  }

  // Should never reach here, but for type safety
  throw new Error('Retry strategy failed');
}

/**
 * Retry wrapper specifically for Twilio messages
 */
export async function withTwilioRetry<T>(
  fn: () => Promise<T>
): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  });
}

/**
 * Retry wrapper specifically for Resend email
 */
export async function withResendRetry<T>(
  fn: () => Promise<T>
): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 2, // Emails are less critical than SMS
    initialDelayMs: 500,
    maxDelayMs: 3000,
    backoffMultiplier: 2,
  });
}
