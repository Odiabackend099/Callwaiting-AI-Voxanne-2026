import CircuitBreaker from 'opossum';
import { createLogger } from './logger';

const logger = createLogger('CircuitBreaker');

/**
 * Create circuit breaker for external API calls
 * Prevents cascading failures when service is down
 */
export function createVapiCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
  }
): CircuitBreaker<any, any> {
  const breaker = new CircuitBreaker(fn, {
    timeout: options?.timeout || 30000,
    errorThresholdPercentage: options?.errorThresholdPercentage || 50,
    resetTimeout: options?.resetTimeout || 30000,
    name: 'VapiAPI'
  });

  // Fallback when circuit is open
  breaker.fallback(() => {
    throw new Error('Vapi service is currently unavailable. Please try again in a moment.');
  });

  // Event listeners for monitoring
  breaker.on('open', () => {
    logger.error('Circuit breaker opened - Vapi API is failing');
  });

  breaker.on('halfOpen', () => {
    logger.warn('Circuit breaker half-open - testing Vapi API');
  });

  breaker.on('close', () => {
    logger.info('Circuit breaker closed - Vapi API is healthy');
  });

  return breaker;
}
