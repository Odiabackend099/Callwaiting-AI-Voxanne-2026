/**
 * Public Signup Endpoint
 *
 * POST /api/auth/signup
 *
 * Creates a new user account via the Supabase Admin API (service role key).
 * The on_auth_user_created DB trigger automatically creates org + profile + JWT metadata.
 *
 * This route is intentionally unauthenticated — it is protected by IP-based rate limiting.
 * It was migrated from the Next.js API route (src/app/api/auth/signup/route.ts) so that
 * the SUPABASE_SERVICE_ROLE_KEY stays on the Render backend and never touches Vercel.
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { config } from '../config';
import { log } from '../services/logger';
import { getRedisClient } from '../config/redis';

const router = Router();

// Fail loudly at module load if credentials are absent — surfaces in Render deployment logs
// rather than silently failing on every signup request with a cryptic auth error.
if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('[auth-signup] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Admin client — module-level, stateless (no session, no token refresh).
// Uses service role key. Runs server-side ONLY.
// Bypasses the Supabase project-level "Allow new users to sign up" restriction.
const adminClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ---------------------------------------------------------------------------
// Rate limiting (5 sign-ups per IP per 60 s)
// ---------------------------------------------------------------------------
// Lazily initialized because getRedisClient() must be called AFTER initializeRedis()
// runs in server.ts. A module-level rateLimit() call would invoke getRedisClient()
// before Redis is ready, return null, and silently fall back to in-memory on every
// instance — defeating the distributed-limit goal.
// Using express-rate-limit + RedisStore (same pattern as org-rate-limiter.ts) makes
// the limit distributed across all Render instances, not per-process.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

let _rateLimiter: ReturnType<typeof rateLimit> | null = null;

function getSignupRateLimiter() {
  if (!_rateLimiter) {
    const redis = getRedisClient();
    _rateLimiter = rateLimit({
      windowMs: WINDOW_MS,
      max: MAX_PER_WINDOW,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => req.ip || 'unknown',
      // Redis store when available (distributed); falls back to in-memory otherwise.
      store: redis
        ? new RedisStore({
            // @ts-expect-error — rate-limit-redis types differ from ioredis types
            client: redis,
            prefix: 'rl:signup:',
            sendCommand: (...args: string[]) => redis.call(...args),
          })
        : undefined,
      handler: (_req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too many sign-up attempts. Please try again in a minute.',
        });
      },
    });
  }
  return _rateLimiter;
}

// ---------------------------------------------------------------------------
// POST /signup
// ---------------------------------------------------------------------------
router.post(
  '/signup',
  // Apply rate limit middleware via lazy getter so Redis is ready by first request.
  (req: Request, res: Response, next) => getSignupRateLimiter()(req, res, next),
  async (req: Request, res: Response) => {
    try {
      const body = req.body;

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: 'Invalid request body.' });
      }

      // --- Type-safe extraction (guards against non-string values) ---
      const trimmedFirst = typeof body.firstName === 'string' ? body.firstName.trim() : '';
      const trimmedLast = typeof body.lastName === 'string' ? body.lastName.trim() : '';
      const trimmedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      // --- Input validation ---
      if (!trimmedFirst || !trimmedLast || !trimmedEmail || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Invalid email address.' });
      }

      if (trimmedFirst.length > 50 || trimmedLast.length > 50) {
        return res.status(400).json({ error: 'Name must be 50 characters or fewer.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      if (password.length > 128) {
        return res.status(400).json({ error: 'Password must be 128 characters or fewer.' });
      }

      // Mirror the frontend strength scoring (getPasswordStrength) — reject score < 2.
      // Prevents direct API calls from bypassing the frontend's strength requirement.
      let strengthScore = 1; // baseline: >= 8 chars
      if (password.length >= 12 || (/[A-Z]/.test(password) && /[a-z]/.test(password))) strengthScore++;
      if (/[0-9]/.test(password)) strengthScore++;
      if (/[^A-Za-z0-9]/.test(password)) strengthScore++;
      strengthScore = Math.min(strengthScore, 4);
      if (strengthScore < 2) {
        return res.status(400).json({
          error: 'Password is too weak — use 8+ characters with a mix of letters and numbers.',
        });
      }

      // --- Create user via admin API ---
      // email_confirm: true — intentional design choice for this product's onboarding UX.
      // Users can sign in immediately without verifying their email address.
      // Accepted risk: registrations with unverified emails are possible.
      // Mitigations: IP rate limiting (5/IP/60s), Supabase project-level signup controls,
      // and Google OAuth as the primary path. Revisit if spam becomes an issue.
      //
      // The on_auth_user_created trigger fires synchronously during this call:
      //   1. Creates public.organizations row
      //   2. Creates public.profiles row (role: 'owner')
      //   3. Writes org_id into auth.users.raw_app_meta_data (→ JWT app_metadata)
      const { error } = await adminClient.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: trimmedFirst,
          last_name: trimmedLast,
          full_name: `${trimmedFirst} ${trimmedLast}`.trim(),
        },
      });

      if (error) {
        // status 422 = email already registered (Supabase's canonical signal).
        if (error.status === 422) {
          // O(1) direct lookup — getUserByEmail uses a DB index, not a paginated scan.
          // Provider info intentionally omitted from the response: leaking which OAuth
          // providers an account uses is an enumeration risk.
          return res.status(409).json({
            error: 'An account with this email already exists. Please sign in instead.',
          });
        }

        log.error('AuthSignup', 'admin.createUser failed', {
          message: error.message,
          status: error.status,
        });
        return res.status(500).json({
          error: 'Failed to create account. Please try again.',
        });
      }

      // 201 Created — a new user resource was created.
      return res.status(201).json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log.error('AuthSignup', 'Unexpected error', { message });
      return res.status(500).json({
        error: 'An unexpected error occurred. Please try again.',
      });
    }
  }
);

export default router;
