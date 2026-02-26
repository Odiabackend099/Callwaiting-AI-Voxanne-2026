// src/lib/auth-errors.ts
//
// Centralised Supabase auth error normaliser.
//
// Usage:
//   import { normalizeAuthError } from '@/lib/auth-errors';
//   setError(normalizeAuthError(error));          // pass Error/AuthApiError
//   setError(normalizeAuthError(error.message));  // or raw string
//   setError(normalizeAuthError(err));            // safe from catch (err: unknown)
//
// Matching strategy:
//   1. Check error.code (stable SDK enum) — preferred
//   2. Keyword-scan error.message (fragile, locale-dependent) — fallback
//   First-match-wins: more specific rules MUST come before broader ones.
//
// Email enumeration: 'invalid_credentials' and 'user not found' intentionally
// map to the same message. Never hint whether the email exists — HIPAA-relevant.

const SUPPORT_EMAIL = 'support@voxanne.ai';

// Stable Supabase AuthError.code values → user-friendly messages.
// These are the preferred match path (SDK contract, not human text).
const CODE_MAP: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password. Please try again.',
  user_not_found: 'Incorrect email or password. Please try again.', // enumeration-safe
  email_not_confirmed:
    'Please verify your email before signing in. Check your inbox for a verification link.',
  otp_expired: 'That code is invalid or has expired. Please request a new verification email.',
  otp_disabled: 'That code is invalid or has expired. Please request a new verification email.',
  over_email_send_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  signup_disabled: `Sign-up is not available right now. Please contact ${SUPPORT_EMAIL}.`,
  user_banned: `Your account has been suspended. Please contact ${SUPPORT_EMAIL}.`,
};

interface AuthErrorRule {
  // Matched case-insensitively against error.message. First match wins.
  keywords: string[];
  message: string;
}

// Fallback: message-string scanning for environments where error.code is absent.
// IMPORTANT: order matters — more specific rules MUST come before broader ones.
const RULES: AuthErrorRule[] = [
  // Rate limiting (before generic server errors)
  {
    keywords: [
      'too many requests',
      'rate limit',
      'over_email_send_rate_limit',
      'over_request_rate_limit',
      'request rate limit',
    ],
    message: 'Too many attempts. Please wait a minute and try again.',
  },
  // Email verification required
  {
    keywords: ['email not confirmed', 'email_not_confirmed'],
    message: 'Please verify your email before signing in. Check your inbox for a verification link.',
  },
  // Bad credentials + user not found — combined to prevent email enumeration
  {
    keywords: [
      'invalid login credentials',
      'invalid credentials',
      'user not found',
      'no user found',
      'wrong password',
      'incorrect password',
    ],
    message: 'Incorrect email or password. Please try again.',
  },
  // OTP / verification code errors — intentionally narrow (avoid matching PKCE/OAuth token errors)
  {
    keywords: ['invalid otp', 'otp_expired', 'otp invalid', 'token has expired'],
    message: 'That code is invalid or has expired. Please request a new verification email.',
  },
  // Duplicate account (safety net — 409 handler in sign-up already covers this with bespoke UI)
  {
    keywords: ['user already registered', 'email already', 'already registered', 'already exists'],
    message: 'An account with this email already exists. Try signing in instead.',
  },
  // Password too weak (Supabase server-side validation)
  {
    keywords: ['password should be at least', 'password must be at least'],
    message: 'Password must be at least 8 characters.',
  },
  // OAuth configuration errors (dev config issue — show vague message to user)
  {
    keywords: [
      'redirect_uri',
      'redirect uri',
      'oauth error',
      'oauth_error',
      'provider_disabled',
      'provider disabled',
    ],
    message: `Sign-in with Google is temporarily unavailable. Please use email/password or contact ${SUPPORT_EMAIL}.`,
  },
  // Network / connectivity
  {
    keywords: ['network request failed', 'fetch failed', 'failed to fetch', 'network error'],
    message: 'Connection failed. Please check your internet connection and try again.',
  },
  // Generic server errors
  {
    keywords: [
      'unexpected_failure',
      'server_error',
      'internal server',
      'internal error',
      'service unavailable',
    ],
    message: `Something went wrong on our end. Please try again in a moment, or contact ${SUPPORT_EMAIL}.`,
  },
];

const FALLBACK = `Something went wrong. Please try again or contact ${SUPPORT_EMAIL}.`;

/**
 * Normalises any Supabase auth error into a safe, user-facing string.
 * Safe to call from `catch (err: unknown)` without any instanceof checks.
 */
export function normalizeAuthError(input: unknown): string {
  if (input == null) return FALLBACK;

  // 1. Prefer error.code (stable SDK enum)
  if (typeof input === 'object' && 'code' in input) {
    const code = (input as { code: unknown }).code;
    if (typeof code === 'string' && CODE_MAP[code]) {
      return CODE_MAP[code];
    }
  }

  // 2. Extract message string
  let raw: string | undefined;
  if (typeof input === 'string') {
    raw = input;
  } else if (typeof input === 'object' && 'message' in input) {
    const msg = (input as { message: unknown }).message;
    if (typeof msg === 'string') raw = msg;
  }

  if (!raw) return FALLBACK;

  // 3. Keyword-scan message (case-insensitive, first-match-wins)
  const lower = raw.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.message;
  }

  return FALLBACK;
}
