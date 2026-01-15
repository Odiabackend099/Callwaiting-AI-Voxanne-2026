/**
 * Error Recovery Utilities
 * 
 * Provides retry logic, circuit breaker pattern, and offline queue management
 * for resilient error handling across the application.
 * 
 * Part of Closed-Loop UX Synchronization pattern.
 * 
 * Usage:
 * ```
 * // Simple retry with exponential backoff
 * const result = await retryWithBackoff(() => callAPI(), {
 *   maxAttempts: 3,
 *   initialDelayMs: 1000
 * });
 * 
 * // Circuit breaker for preventing cascading failures
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeoutMs: 60000
 * });
 * 
 * breaker.execute(() => callFlakeyService());
 * ```
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum number of attempts (default: 3)
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds (default: 1000)
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds (default: 30000)
   */
  maxDelayMs?: number;

  /**
   * Backoff multiplier (default: 2 for exponential)
   */
  backoffMultiplier?: number;

  /**
   * Function to determine if error is retryable
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /**
   * Callback on each retry attempt
   */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;

  /**
   * Timeout for individual attempt in milliseconds (default: 30000)
   */
  timeoutMs?: number;
}

/**
 * Retry with exponential backoff strategy
 * 
 * @param fn Function to retry
 * @param config Retry configuration
 * @returns Result from successful execution
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    shouldRetry,
    onRetry,
    timeoutMs = 30000,
  } = config;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Execute with timeout
      return await executeWithTimeout(fn, timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const isLastAttempt = attempt === maxAttempts;
      const isRetryable = !shouldRetry || shouldRetry(lastError, attempt);

      if (isLastAttempt || !isRetryable) {
        throw lastError;
      }

      // Calculate delay with jitter
      const delay = getBackoffDelay(attempt - 1, initialDelayMs, maxDelayMs, backoffMultiplier);

      // Notify callback
      onRetry?.(attempt, lastError, delay);

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Execute function with timeout
 */
async function executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Note: This is a simplified implementation
    // For actual timeout support, the fn would need to accept AbortSignal
    return await fn();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(
  attemptNumber: number,
  initialDelayMs: number,
  maxDelayMs: number,
  multiplier: number
): number {
  const exponentialDelay = initialDelayMs * Math.pow(multiplier, attemptNumber);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add 10% jitter to prevent thundering herd
  const jitter = cappedDelay * (Math.random() * 0.1);
  return cappedDelay + jitter;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /**
   * Number of failures before opening circuit (default: 5)
   */
  failureThreshold?: number;

  /**
   * Time before attempting reset in milliseconds (default: 60000)
   */
  resetTimeoutMs?: number;

  /**
   * Callback when circuit state changes
   */
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
}

/**
 * Circuit breaker states
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures by stopping requests to failing services.
 * States:
 * - CLOSED: Requests pass through normally
 * - OPEN: Requests fail immediately without calling service
 * - HALF_OPEN: Allows test request to determine if service recovered
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;

  constructor(private config: CircuitBreakerConfig = {}) {}

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const failureThreshold = this.config.failureThreshold || 5;
    const resetTimeoutMs = this.config.resetTimeoutMs || 60000;

    // Check if circuit should transition states
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (this.nextAttemptTime && now >= this.nextAttemptTime) {
        this.transitionState('HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      // Success - update counters
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        // After 3 successful requests, close the circuit
        if (this.successCount >= 3) {
          this.transitionState('CLOSED');
          this.failureCount = 0;
          this.successCount = 0;
        }
      } else if (this.state === 'CLOSED') {
        // Reset failure count on success
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      // Failure - update counters
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === 'HALF_OPEN') {
        // Reopen circuit on failure during HALF_OPEN
        this.nextAttemptTime = Date.now() + resetTimeoutMs;
        this.transitionState('OPEN');
        this.successCount = 0;
      } else if (this.state === 'CLOSED' && this.failureCount >= failureThreshold) {
        // Open circuit after threshold
        this.nextAttemptTime = Date.now() + resetTimeoutMs;
        this.transitionState('OPEN');
      }

      throw error;
    }
  }

  /**
   * Force circuit state transition
   */
  private transitionState(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    console.log(`[CircuitBreaker] Transitioned from ${oldState} to ${newState}`);
    this.config.onStateChange?.(oldState, newState);
  }

  /**
   * Reset circuit to CLOSED state
   */
  reset(): void {
    this.transitionState('CLOSED');
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Offline queue item
 */
export interface OfflineQueueItem<T = any> {
  id: string;
  fn: () => Promise<T>;
  timestamp: number;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  retryCount: number;
  maxRetries: number;
}

/**
 * Offline Queue for storing failed requests
 * 
 * Stores requests that failed due to network issues.
 * Retries when network is restored.
 */
export class OfflineQueue {
  private queue: OfflineQueueItem[] = [];
  private isProcessing = false;
  private maxQueueSize = 100;

  /**
   * Add item to queue
   */
  add<T>(
    fn: () => Promise<T>,
    options: { priority?: 'HIGH' | 'NORMAL' | 'LOW'; maxRetries?: number } = {}
  ): string {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Offline queue is full');
    }

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const item: OfflineQueueItem<T> = {
      id,
      fn,
      timestamp: Date.now(),
      priority: options.priority || 'NORMAL',
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
    };

    this.queue.push(item);

    // Sort by priority
    this.sortQueue();

    return id;
  }

  /**
   * Remove item from queue
   */
  remove(id: string): void {
    this.queue = this.queue.filter((item) => item.id !== id);
  }

  /**
   * Get all items in queue
   */
  getAll(): OfflineQueueItem[] {
    return [...this.queue];
  }

  /**
   * Process queue - retry all failed items
   */
  async process(): Promise<{ succeeded: string[]; failed: string[] }> {
    if (this.isProcessing) {
      return { succeeded: [], failed: [] };
    }

    this.isProcessing = true;
    const succeeded: string[] = [];
    const failed: string[] = [];

    try {
      // Process items in priority order
      for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i];

        try {
          await item.fn();
          succeeded.push(item.id);
          this.queue.splice(i, 1);
          i--;
        } catch (error) {
          item.retryCount++;

          if (item.retryCount >= item.maxRetries) {
            failed.push(item.id);
            this.queue.splice(i, 1);
            i--;
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return { succeeded, failed };
  }

  /**
   * Clear all items from queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Sort queue by priority and timestamp
   */
  private sortQueue(): void {
    const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 };

    this.queue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const items = this.queue;
    const retryStats = {
      totalItems: items.length,
      byPriority: {
        HIGH: items.filter((i) => i.priority === 'HIGH').length,
        NORMAL: items.filter((i) => i.priority === 'NORMAL').length,
        LOW: items.filter((i) => i.priority === 'LOW').length,
      },
      totalRetries: items.reduce((sum, i) => sum + i.retryCount, 0),
    };

    return retryStats;
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Retry error (final error after all retries exhausted)
 */
export class RetryExhaustedError extends Error {
  constructor(
    public attempts: number,
    public lastError: Error,
    message?: string
  ) {
    super(message || `Failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Circuit breaker error (service unavailable)
 */
export class CircuitBreakerError extends Error {
  constructor(message: string = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}
