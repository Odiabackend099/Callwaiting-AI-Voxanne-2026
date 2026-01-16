/**
 * SafeCall: Resilient API Call Wrapper
 *
 * 2026 Standard: Graceful Degradation
 *
 * Problem: When third-party APIs (Google, Twilio, etc) fail, the system crashes
 * Solution: SafeCall provides:
 * - Automatic retry with exponential backoff
 * - Circuit breaker pattern (fail gracefully after N failures)
 * - Token refresh middleware for expired credentials
 * - Detailed error classification for better UX
 *
 * Example:
 *  const result = await safeCall(
 *    'google_calendar_book',
 *    () => calendar.events.insert(...),
 *    { retries: 3, backoffMs: 1000 }
 *  );
 *
 *  if (result.success) {
 *    AI.tell(user, "Appointment booked!");
 *  } else {
 *    AI.tell(user, result.userMessage); // "Our system is updating..."
 *  }
 */

import { log } from './logger';

/**
 * Error types for circuit breaker logic
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_STATE = 'INVALID_STATE',
  TEMPORARY = 'TEMPORARY',
  PERMANENT = 'PERMANENT'
}

/**
 * Classify error for retry logic
 */
function classifyError(error: any): ErrorType {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code || error?.response?.status;

  // Auth errors: don't retry
  if (code === 401 || code === 403 || message.includes('unauthorized')) {
    return ErrorType.AUTH;
  }

  // Rate limit: retry with backoff
  if (code === 429 || message.includes('too many requests')) {
    return ErrorType.RATE_LIMIT;
  }

  // Network: retry immediately
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || message.includes('network')) {
    return ErrorType.NETWORK;
  }

  // Invalid state: check token expiry
  if (code === 400 || message.includes('invalid_grant')) {
    return ErrorType.INVALID_STATE;
  }

  // Temporary errors: retry with backoff
  if (code >= 500 || message.includes('temporarily')) {
    return ErrorType.TEMPORARY;
  }

  // Permanent errors: don't retry
  return ErrorType.PERMANENT;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Check if circuit is open
 */
function isCircuitOpen(serviceName: string): boolean {
  const state = circuitBreakers.get(serviceName);
  if (!state) return false;

  // If open, check if enough time has passed to retry
  if (state.isOpen) {
    const timeSinceLastFailure = Date.now() - state.lastFailureTime;
    const cooldownMs = 30000; // 30 second cooldown

    if (timeSinceLastFailure > cooldownMs) {
      // Try again
      state.isOpen = false;
      state.failures = 0;
      log.info('SafeCall', `Circuit breaker closed for ${serviceName}`, {
        cooldownElapsedMs: timeSinceLastFailure
      });
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Mark circuit failure
 */
function recordFailure(serviceName: string): void {
  let state = circuitBreakers.get(serviceName);

  if (!state) {
    state = { failures: 0, lastFailureTime: Date.now(), isOpen: false };
    circuitBreakers.set(serviceName, state);
  }

  state.failures++;
  state.lastFailureTime = Date.now();

  // Open circuit after 3 failures
  if (state.failures >= 3) {
    state.isOpen = true;
    log.error('SafeCall', `Circuit breaker opened for ${serviceName}`, {
      failures: state.failures,
      nextRetryIn: '30s'
    });
  }
}

/**
 * Reset circuit on success
 */
function recordSuccess(serviceName: string): void {
  const state = circuitBreakers.get(serviceName);
  if (state) {
    state.failures = 0;
    state.isOpen = false;
  }
}

export interface SafeCallOptions {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface SafeCallResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  errorType?: ErrorType;
  attempts: number;
  circuitOpen?: boolean;
  userMessage: string; // User-friendly message for AI to read to customer
}

/**
 * SafeCall: Resilient API call with automatic retry + circuit breaker
 */
export async function safeCall<T>(
  serviceName: string,
  fn: () => Promise<T>,
  options: SafeCallOptions = {}
): Promise<SafeCallResult<T>> {
  const {
    retries = 3,
    backoffMs = 1000,
    timeoutMs = 15000,
    onRetry
  } = options;

  // Check circuit breaker
  if (isCircuitOpen(serviceName)) {
    log.warn('SafeCall', `Circuit open for ${serviceName}`, {
      service: serviceName
    });

    return {
      success: false,
      errorType: ErrorType.TEMPORARY,
      attempts: 0,
      circuitOpen: true,
      userMessage: `Our ${serviceName} system is temporarily unavailable. Please try again in a moment.`
    };
  }

  let lastError: Error | null = null;
  let lastErrorType = ErrorType.PERMANENT;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Execute with timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        )
      ]);

      // Success!
      recordSuccess(serviceName);
      log.debug('SafeCall', `${serviceName} succeeded`, {
        attempt: attempt + 1,
        attempts: retries
      });

      return {
        success: true,
        data: result,
        attempts: attempt + 1,
        userMessage: ''
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      lastErrorType = classifyError(lastError);

      log.warn('SafeCall', `${serviceName} attempt ${attempt + 1}/${retries} failed`, {
        error: lastError.message,
        errorType: lastErrorType,
        service: serviceName
      });

      // Permanent errors: don't retry
      if (lastErrorType === ErrorType.AUTH || lastErrorType === ErrorType.PERMANENT) {
        recordFailure(serviceName);
        break;
      }

      // Callback for custom handling (e.g., token refresh)
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // Wait before retry (exponential backoff)
      if (attempt < retries - 1) {
        const delayMs = backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted
  recordFailure(serviceName);

  // Determine user-friendly message based on error type
  let userMessage = `We're having trouble with ${serviceName}. Our team is on it!`;

  switch (lastErrorType) {
    case ErrorType.AUTH:
      userMessage = `Authorization error with ${serviceName}. Please contact support.`;
      break;
    case ErrorType.RATE_LIMIT:
      userMessage = `Too many requests to ${serviceName}. Please try again in a moment.`;
      break;
    case ErrorType.NETWORK:
      userMessage = `Network issue with ${serviceName}. Please check your connection.`;
      break;
    case ErrorType.TEMPORARY:
      userMessage = `${serviceName} is temporarily unavailable. We're working on it.`;
      break;
  }

  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    errorType: lastErrorType,
    attempts: retries,
    circuitOpen: false,
    userMessage
  };
}

/**
 * Middleware for automatic token refresh on auth errors
 * Use this with safeCall to auto-refresh tokens
 */
export async function withTokenRefresh<T>(
  serviceName: string,
  fn: () => Promise<T>,
  refreshToken: () => Promise<void>,
  options: SafeCallOptions = {}
): Promise<SafeCallResult<T>> {
  return safeCall(serviceName, fn, {
    ...options,
    onRetry: async (attempt, error) => {
      // On first failure, try refreshing token
      if (attempt === 1 && classifyError(error) === ErrorType.INVALID_STATE) {
        log.info('SafeCall', `Attempting token refresh for ${serviceName}`, {
          service: serviceName
        });

        try {
          await refreshToken();
          log.info('SafeCall', `Token refreshed for ${serviceName}`, {
            service: serviceName
          });
        } catch (refreshError) {
          log.error('SafeCall', `Token refresh failed for ${serviceName}`, {
            service: serviceName,
            error: refreshError instanceof Error ? refreshError.message : String(refreshError)
          });
        }
      }
    }
  });
}

/**
 * Batch safe calls (e.g., send to multiple services in parallel, fail gracefully)
 */
export async function safeCallBatch<T>(
  calls: Array<{ name: string; fn: () => Promise<T> }>
): Promise<Array<SafeCallResult<T>>> {
  return Promise.all(
    calls.map(({ name, fn }) => safeCall(name, fn))
  );
}

/**
 * Get circuit breaker status (for diagnostics)
 */
export function getCircuitBreakerStatus() {
  const status: Record<string, CircuitBreakerState> = {};

  for (const [name, state] of circuitBreakers.entries()) {
    status[name] = { ...state };
  }

  return status;
}
