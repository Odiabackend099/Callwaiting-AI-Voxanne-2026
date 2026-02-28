/**
 * Unit tests for src/lib/auth-errors.ts
 *
 * normalizeAuthError() centralises Supabase auth error normalisation.
 * These tests verify:
 * - Null/undefined/empty input → fallback string (never throws)
 * - error.code map — 10 specific codes map to user-friendly messages
 * - Email enumeration protection — invalid_credentials and user_not_found
 *   produce IDENTICAL messages
 * - Fallback RULES — keyword-scan of error.message string (9 patterns)
 * - Type safety — safe to call from catch (err: unknown) without any
 *   instanceof guards
 */

import { describe, it, expect } from 'vitest';
import { normalizeAuthError } from '../../lib/auth-errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPPORT = 'support@voxanne.ai';

function errWithCode(code: string, message = ''): unknown {
  return { code, message };
}

function errWithMessage(message: string): unknown {
  return { message };
}

// ---------------------------------------------------------------------------
// Safe / fallback inputs
// ---------------------------------------------------------------------------

describe('normalizeAuthError — safe inputs', () => {
  it('returns a non-empty string for null', () => {
    const result = normalizeAuthError(null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for undefined', () => {
    const result = normalizeAuthError(undefined);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for empty string', () => {
    const result = normalizeAuthError('');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns fallback for a number', () => {
    const result = normalizeAuthError(42 as unknown);
    expect(typeof result).toBe('string');
  });

  it('returns fallback for an empty object', () => {
    const result = normalizeAuthError({});
    expect(typeof result).toBe('string');
  });

  it('never throws regardless of input', () => {
    const weirdInputs: unknown[] = [
      null, undefined, '', 0, false, [], {}, { code: null }, { message: 42 }, Symbol('x'),
    ];
    for (const input of weirdInputs) {
      expect(() => normalizeAuthError(input)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// error.code map (10 entries)
// ---------------------------------------------------------------------------

describe('normalizeAuthError — CODE_MAP (10 entries)', () => {
  it('invalid_credentials → credentials message', () => {
    const result = normalizeAuthError(errWithCode('invalid_credentials'));
    expect(result).toContain('Incorrect email or password');
  });

  it('user_not_found → SAME credentials message (enumeration-safe)', () => {
    const result = normalizeAuthError(errWithCode('user_not_found'));
    expect(result).toContain('Incorrect email or password');
  });

  it('email_not_confirmed → verify email message', () => {
    const result = normalizeAuthError(errWithCode('email_not_confirmed'));
    expect(result.toLowerCase()).toContain('verify your email');
  });

  it('otp_expired → code invalid/expired message', () => {
    const result = normalizeAuthError(errWithCode('otp_expired'));
    expect(result.toLowerCase()).toMatch(/invalid|expired/);
  });

  it('otp_disabled → same code invalid/expired message', () => {
    const result = normalizeAuthError(errWithCode('otp_disabled'));
    expect(result.toLowerCase()).toMatch(/invalid|expired/);
  });

  it('over_email_send_rate_limit → rate limit message', () => {
    const result = normalizeAuthError(errWithCode('over_email_send_rate_limit'));
    expect(result.toLowerCase()).toContain('too many attempts');
  });

  it('over_request_rate_limit → rate limit message', () => {
    const result = normalizeAuthError(errWithCode('over_request_rate_limit'));
    expect(result.toLowerCase()).toContain('too many attempts');
  });

  it('user_already_exists → account exists message', () => {
    const result = normalizeAuthError(errWithCode('user_already_exists'));
    expect(result.toLowerCase()).toContain('account');
    expect(result.toLowerCase()).toContain('already exists');
  });

  it('signup_disabled → contact support message', () => {
    const result = normalizeAuthError(errWithCode('signup_disabled'));
    expect(result).toContain(SUPPORT);
  });

  it('user_banned → contact support message', () => {
    const result = normalizeAuthError(errWithCode('user_banned'));
    expect(result).toContain(SUPPORT);
  });
});

// ---------------------------------------------------------------------------
// Email enumeration protection (critical security invariant)
// ---------------------------------------------------------------------------

describe('normalizeAuthError — email enumeration protection', () => {
  it('invalid_credentials and user_not_found produce IDENTICAL messages', () => {
    const a = normalizeAuthError(errWithCode('invalid_credentials'));
    const b = normalizeAuthError(errWithCode('user_not_found'));
    expect(a).toBe(b);
  });

  it('error.code takes precedence over error.message', () => {
    // code says rate limit, message says invalid password — code wins
    const result = normalizeAuthError({
      code: 'over_request_rate_limit',
      message: 'invalid login credentials',
    });
    expect(result.toLowerCase()).toContain('too many attempts');
    expect(result.toLowerCase()).not.toContain('incorrect email');
  });
});

// ---------------------------------------------------------------------------
// Fallback RULES — keyword scanning (9 rules)
// ---------------------------------------------------------------------------

describe('normalizeAuthError — fallback RULES (message keyword scan)', () => {
  it('message "too many requests" → rate limit message', () => {
    const result = normalizeAuthError(errWithMessage('too many requests from this IP'));
    expect(result.toLowerCase()).toContain('too many attempts');
  });

  it('message "rate limit" → rate limit message', () => {
    const result = normalizeAuthError(errWithMessage('over_request_rate_limit exceeded'));
    expect(result.toLowerCase()).toContain('too many attempts');
  });

  it('message "email not confirmed" → verify email message', () => {
    const result = normalizeAuthError(errWithMessage('email not confirmed'));
    expect(result.toLowerCase()).toContain('verify your email');
  });

  it('message "invalid login credentials" → credentials message', () => {
    const result = normalizeAuthError(errWithMessage('invalid login credentials'));
    expect(result).toContain('Incorrect email or password');
  });

  it('message "wrong password" → credentials message', () => {
    const result = normalizeAuthError(errWithMessage('wrong password provided'));
    expect(result).toContain('Incorrect email or password');
  });

  it('message "user not found" → credentials message (enumeration-safe)', () => {
    const result = normalizeAuthError(errWithMessage('no user found with that email'));
    expect(result).toContain('Incorrect email or password');
  });

  it('message "invalid otp" → OTP expired message', () => {
    const result = normalizeAuthError(errWithMessage('invalid otp provided'));
    expect(result.toLowerCase()).toMatch(/invalid|expired/);
  });

  it('message "user already registered" → account exists message', () => {
    const result = normalizeAuthError(errWithMessage('user already registered'));
    expect(result.toLowerCase()).toContain('already exists');
  });

  it('message "password should be at least 8" → password length message', () => {
    const result = normalizeAuthError(errWithMessage('password should be at least 8 characters'));
    expect(result.toLowerCase()).toContain('password');
    expect(result.toLowerCase()).toContain('8');
  });

  it('message "network request failed" → connection failed message', () => {
    const result = normalizeAuthError(errWithMessage('network request failed'));
    expect(result.toLowerCase()).toContain('connection');
  });

  it('message "internal server error" → generic server error message', () => {
    const result = normalizeAuthError(errWithMessage('internal server error'));
    expect(result.toLowerCase()).toMatch(/something went wrong|server/);
  });
});

// ---------------------------------------------------------------------------
// Type safety — common catch (err: unknown) patterns
// ---------------------------------------------------------------------------

describe('normalizeAuthError — type safety in catch blocks', () => {
  it('handles a real Error object', () => {
    const result = normalizeAuthError(new Error('network request failed'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles a raw string (message-only)', () => {
    const result = normalizeAuthError('invalid login credentials');
    expect(result).toContain('Incorrect email or password');
  });

  it('handles a Supabase-style AuthError object', () => {
    const supabaseError = {
      name: 'AuthApiError',
      message: 'Invalid login credentials',
      status: 400,
      code: 'invalid_credentials',
    };
    const result = normalizeAuthError(supabaseError);
    expect(result).toContain('Incorrect email or password');
  });

  it('handles unknown code gracefully — falls back to keyword scan', () => {
    const result = normalizeAuthError({ code: 'unknown_future_code', message: 'rate limit exceeded' });
    expect(typeof result).toBe('string');
    // 'rate limit' in message → rate limit fallback rule
    expect(result.toLowerCase()).toContain('too many attempts');
  });

  it('handles unknown code and unrecognised message → returns fallback string', () => {
    const result = normalizeAuthError({ code: 'completely_unknown', message: 'something truly bespoke' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
