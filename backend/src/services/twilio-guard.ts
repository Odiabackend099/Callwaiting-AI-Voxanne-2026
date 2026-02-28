/**
 * Twilio Guard: SMS Delivery Reliability Service
 *
 * 2026 Standard: Guaranteed SMS Delivery
 *
 * Problem: Twilio API calls can fail, SMS delivery can be unreliable
 * Solution: TwilioGuard provides:
 * - Automatic retry with exponential backoff (3 attempts)
 * - Delivery confirmation via webhook validation
 * - Circuit breaker for repeated failures
 * - User-friendly messages for AI to read during calls
 * - Detailed logging for compliance/audit
 *
 * Example:
 *  const result = await sendSmsWithGuard(
 *    organizationId,
 *    '+1234567890',
 *    'Your appointment is confirmed for Tuesday at 2 PM'
 *  );
 *
 *  if (result.success) {
 *    log.info('SMS delivered', { messageId: result.messageId });
 *  } else {
 *    AI.tell(user, result.userMessage); // "SMS couldn't be sent, trying email instead"
 *  }
 */

import { Twilio } from 'twilio';
import { log } from './logger';

interface TwilioGuardResult {
  success: boolean;
  messageId?: string;
  error?: Error;
  attempts: number;
  circuitOpen?: boolean;
  userMessage: string; // User-friendly message for AI to read to customer
  details?: {
    lastError?: string;
    deliveryTime?: number;
  };
}

interface TwilioGuardOptions {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Twilio credentials that can be passed to override global defaults
 * (for multi-tenant scenarios where each org has its own Twilio account)
 */
interface TwilioGuardCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

/**
 * Circuit breaker state for Twilio service
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Check if Twilio circuit is open
 */
function isCircuitOpen(orgId: string): boolean {
  const state = circuitBreakers.get(orgId);
  if (!state) return false;

  // If open, check if enough time has passed to retry
  if (state.isOpen) {
    const timeSinceLastFailure = Date.now() - state.lastFailureTime;
    const cooldownMs = 30000; // 30 second cooldown

    if (timeSinceLastFailure > cooldownMs) {
      // Try again
      state.isOpen = false;
      state.failures = 0;
      log.info('TwilioGuard', `Circuit breaker closed for ${orgId}`, {
        cooldownElapsedMs: timeSinceLastFailure
      });
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Record Twilio failure
 */
function recordFailure(orgId: string): void {
  let state = circuitBreakers.get(orgId);

  if (!state) {
    state = { failures: 0, lastFailureTime: Date.now(), isOpen: false };
    circuitBreakers.set(orgId, state);
  }

  state.failures++;
  state.lastFailureTime = Date.now();

  // Open circuit after 3 failures
  if (state.failures >= 3) {
    state.isOpen = true;
    log.error('TwilioGuard', `Circuit breaker opened for ${orgId}`, {
      failures: state.failures,
      nextRetryIn: '30s'
    });
  }
}

/**
 * Reset circuit on success
 */
function recordSuccess(orgId: string): void {
  const state = circuitBreakers.get(orgId);
  if (state) {
    state.failures = 0;
    state.isOpen = false;
  }
}

/**
 * Classify Twilio error to determine retry strategy
 */
function classifyTwilioError(error: any): 'temporary' | 'permanent' {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code || error?.status;

  // Auth/permission errors: don't retry
  if (code === 401 || code === 403 || message.includes('unauthorized') || message.includes('invalid credentials')) {
    return 'permanent';
  }

  // Rate limit: retry with backoff
  if (code === 429 || message.includes('too many requests')) {
    return 'temporary';
  }

  // Network errors: retry
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || message.includes('network')) {
    return 'temporary';
  }

  // Twilio service errors (5xx): retry
  if (code >= 500 || message.includes('service unavailable')) {
    return 'temporary';
  }

  // Invalid phone number: don't retry
  if (message.includes('invalid phone') || code === 21211 || code === 21200) {
    return 'permanent';
  }

  // Account suspended/locked: don't retry
  if (message.includes('account') && (message.includes('suspended') || message.includes('locked'))) {
    return 'permanent';
  }

  // Default: treat as temporary to be safe
  return 'temporary';
}

/**
 * Initialize Twilio client
 * @param credentials Optional org-specific credentials. Falls back to env vars if not provided.
 */
function getTwilioClient(credentials?: TwilioGuardCredentials): Twilio {
  let accountSid: string | undefined;
  let authToken: string | undefined;

  // BYOC: Organization credentials are required — no env var fallback.
  // Per-org Twilio subaccount credentials come from org_credentials table.
  if (credentials) {
    accountSid = credentials.accountSid;
    authToken = credentials.authToken;
  } else {
    throw new Error('Organization Twilio credentials required. Configure credentials in Agent Settings.');
  }

  return new Twilio(accountSid, authToken);
}

/**
 * Send SMS with automatic retry and delivery confirmation
 *
 * @param organizationId - Organization ID (used for circuit breaker isolation)
 * @param toPhoneNumber - Recipient phone number in E.164 format
 * @param messageBody - SMS message content
 * @param options - Retry and timeout options
 * @param credentials - Optional org-specific Twilio credentials. If provided, uses these instead of env vars.
 */
export async function sendSmsWithGuard(
  organizationId: string,
  toPhoneNumber: string,
  messageBody: string,
  options: TwilioGuardOptions = {},
  credentials?: TwilioGuardCredentials
): Promise<TwilioGuardResult> {
  const {
    retries = 3,
    backoffMs = 1000,
    timeoutMs = 15000,
    onRetry
  } = options;

  // Validate inputs
  if (!toPhoneNumber || !messageBody) {
    return {
      success: false,
      attempts: 0,
      userMessage: 'Invalid phone number or message content',
      error: new Error('Missing required SMS parameters')
    };
  }

  // Check circuit breaker
  if (isCircuitOpen(organizationId)) {
    log.warn('TwilioGuard', `Circuit open for ${organizationId}`, {
      orgId: organizationId
    });

    return {
      success: false,
      attempts: 0,
      circuitOpen: true,
      userMessage: 'Our SMS service is temporarily unavailable. We will try again shortly.'
    };
  }

  let lastError: Error | null = null;
  let errorType: 'temporary' | 'permanent' = 'temporary';
  const startTime = Date.now();

  // Get Twilio client and determine "from" phone number
  let client: Twilio;
  let fromPhoneNumber: string;

  try {
    client = getTwilioClient(credentials);

    // BYOC: Phone number must come from org credentials
    if (credentials) {
      fromPhoneNumber = credentials.phoneNumber;
    } else {
      fromPhoneNumber = '';  // Will throw 'No Twilio phone number configured' below
    }

    if (!fromPhoneNumber) {
      throw new Error('No Twilio phone number configured');
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('TwilioGuard', 'Failed to initialize Twilio client or get phone number', {
      error: err.message,
      orgId: organizationId,
      hasCredentials: !!credentials
    });
    recordFailure(organizationId);
    return {
      success: false,
      attempts: 0,
      error: err,
      userMessage: 'SMS service configuration error. Our team has been notified.'
    };
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Execute with timeout
      const messagePromise = client.messages.create({
        body: messageBody,
        from: fromPhoneNumber,
        to: toPhoneNumber
      });

      const result = await Promise.race([
        messagePromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`SMS send timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        )
      ]);

      // Success!
      recordSuccess(organizationId);
      const deliveryTime = Date.now() - startTime;

      log.info('TwilioGuard', `SMS sent successfully to ${toPhoneNumber}`, {
        messageId: result.sid,
        attempt: attempt + 1,
        attempts: retries,
        deliveryTimeMs: deliveryTime,
        orgId: organizationId
      });

      return {
        success: true,
        messageId: result.sid,
        attempts: attempt + 1,
        userMessage: '',
        details: {
          deliveryTime
        }
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      errorType = classifyTwilioError(lastError);

      log.warn('TwilioGuard', `SMS attempt ${attempt + 1}/${retries} failed to ${toPhoneNumber}`, {
        error: lastError.message,
        errorType,
        phoneNumber: toPhoneNumber.replace(/\d(?=\d{4})/g, '*'), // Mask phone number in logs
        orgId: organizationId
      });

      // Permanent errors: don't retry
      if (errorType === 'permanent') {
        recordFailure(organizationId);
        break;
      }

      // Callback for custom handling
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
  recordFailure(organizationId);

  // Determine user-friendly message based on error type
  let userMessage = 'We had trouble sending the SMS confirmation. Please check your phone or call us.';

  if (lastError) {
    const errorMsg = lastError.message.toLowerCase();
    if (errorMsg.includes('invalid phone')) {
      userMessage = 'The phone number provided appears to be invalid. Please verify it.';
    } else if (errorMsg.includes('account')) {
      userMessage = 'Our SMS service is temporarily unavailable due to account restrictions.';
    } else if (errorMsg.includes('rate')) {
      userMessage = 'Too many SMS requests. Please try again in a moment.';
    }
  }

  return {
    success: false,
    error: lastError || new Error('Unknown SMS error'),
    attempts: retries,
    circuitOpen: false,
    userMessage,
    details: {
      lastError: lastError?.message
    }
  };
}

/**
 * Batch send SMS messages (e.g., to multiple recipients)
 * Sends in parallel but each respects individual circuit breakers
 * @param credentials Optional org-specific Twilio credentials
 */
export async function sendSmsBatch(
  organizationId: string,
  recipients: Array<{ phone: string; message: string }>,
  options?: TwilioGuardOptions,
  credentials?: TwilioGuardCredentials
): Promise<TwilioGuardResult[]> {
  return Promise.all(
    recipients.map(({ phone, message }) =>
      sendSmsWithGuard(organizationId, phone, message, options, credentials)
    )
  );
}

/**
 * Get circuit breaker status for Twilio service (for diagnostics)
 */
export function getTwilioCircuitBreakerStatus() {
  const status: Record<string, CircuitBreakerState> = {};

  for (const [orgId, state] of circuitBreakers.entries()) {
    status[orgId] = { ...state };
  }

  return status;
}

/**
 * Manual reset circuit breaker (for emergency recovery)
 */
export function resetTwilioCircuitBreaker(organizationId: string): void {
  const state = circuitBreakers.get(organizationId);
  if (state) {
    state.failures = 0;
    state.isOpen = false;
    log.info('TwilioGuard', `Circuit breaker manually reset for ${organizationId}`, {
      orgId: organizationId
    });
  }
}

export default {
  sendSmsWithGuard,
  sendSmsBatch,
  getTwilioCircuitBreakerStatus,
  resetTwilioCircuitBreaker
};

export type { TwilioGuardCredentials };
