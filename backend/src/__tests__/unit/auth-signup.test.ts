/**
 * Unit Tests for POST /api/auth/signup
 * File: backend/src/routes/auth-signup.ts
 *
 * Tests verify:
 * - Input validation (required fields, email format, name/password length limits)
 * - Successful signup → 201 { success: true }
 * - Duplicate email → 409 with NO providers array (P0 enumeration protection)
 * - Supabase admin error → 500 (sanitized message)
 * - CSRF not required (public endpoint — skipped in csrf-protection skipPaths)
 *
 * Rate limiting (5/IP/60s) is tested in integration/rate-limiting.test.ts.
 *
 * Mock strategy:
 * - @supabase/supabase-js createClient → mock adminClient.auth.admin.createUser
 * - ../../config → inject test SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * - ../../config/redis → return null (falls back to in-memory rate limiter)
 * - express-rate-limit → pass-through (rate limit behaviour not under test here)
 * - ../../services/logger → silent mock
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

// ---------------------------------------------------------------------------
// Mocks — MUST come before any import that transitively touches these modules
// ---------------------------------------------------------------------------

// Mock config so the module-level guard doesn't throw
jest.mock('../../config', () => ({
  config: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    NODE_ENV: 'test',
  },
}));

// Mock Redis — return null so rate limiter uses in-memory store
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue(null),
}));

// Mock rate-limit-redis (imported by the route; must exist even when redis is null)
jest.mock('rate-limit-redis', () => jest.fn());

// Mock express-rate-limit — pass-through for unit tests
// (rate limiting behaviour is covered by integration/rate-limiting.test.ts)
jest.mock('express-rate-limit', () =>
  jest.fn(() => (_req: any, _res: any, next: any) => next())
);

// Mock Supabase admin client
const mockCreateUser = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
      },
    },
  })),
}));

// Silent logger
jest.mock('../../services/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import authSignupRouter from '../../routes/auth-signup';

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

let app: Express;

beforeEach(() => {
  jest.clearAllMocks();

  app = express();
  app.use(express.json());
  app.use('/api/auth', authSignupRouter);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_BODY = {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  password: 'SecurePass1!',
};

function post(body: object) {
  return request(app).post('/api/auth/signup').send(body);
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('POST /api/auth/signup — input validation', () => {
  test('returns 400 when firstName is missing', async () => {
    const { firstName: _removed, ...body } = VALID_BODY;
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('returns 400 when lastName is missing', async () => {
    const { lastName: _removed, ...body } = VALID_BODY;
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when email is missing', async () => {
    const { email: _removed, ...body } = VALID_BODY;
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when password is missing', async () => {
    const { password: _removed, ...body } = VALID_BODY;
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 for invalid email format', async () => {
    const res = await post({ ...VALID_BODY, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid email/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('returns 400 for email with no domain', async () => {
    const res = await post({ ...VALID_BODY, email: 'user@' });
    expect(res.status).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('returns 400 when password is shorter than 8 characters', async () => {
    const res = await post({ ...VALID_BODY, password: 'abc123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('returns 400 when password is longer than 128 characters', async () => {
    const res = await post({ ...VALID_BODY, password: 'A'.repeat(129) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/128 characters/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('returns 400 when firstName exceeds 50 characters', async () => {
    const res = await post({ ...VALID_BODY, firstName: 'A'.repeat(51) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/50 characters/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('returns 400 when lastName exceeds 50 characters', async () => {
    const res = await post({ ...VALID_BODY, lastName: 'B'.repeat(51) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/50 characters/i);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('returns 400 for non-object request body', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .set('Content-Type', 'application/json')
      .send('null');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Successful signup
// ---------------------------------------------------------------------------

describe('POST /api/auth/signup — success', () => {
  test('returns 201 with { success: true } on valid data', async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null });

    const res = await post(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true });
  });

  test('calls adminClient.auth.admin.createUser with correct params', async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid' } }, error: null });

    await post(VALID_BODY);

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'alice@example.com',
        password: 'SecurePass1!',
        email_confirm: true,
        user_metadata: expect.objectContaining({
          first_name: 'Alice',
          last_name: 'Smith',
        }),
      })
    );
  });

  test('lowercases and trims email before sending to Supabase', async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid' } }, error: null });

    await post({ ...VALID_BODY, email: '  Alice@EXAMPLE.COM  ' });

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' })
    );
  });
});

// ---------------------------------------------------------------------------
// Duplicate email — P0 security fix (no provider enumeration)
// ---------------------------------------------------------------------------

describe('POST /api/auth/signup — duplicate email (P0 enumeration protection)', () => {
  test('returns 409 when email already exists (Supabase status 422)', async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { status: 422, message: 'Email already registered' },
    });

    const res = await post(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  test('409 response does NOT include providers array (enumeration protection)', async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { status: 422, message: 'Email already registered' },
    });

    const res = await post(VALID_BODY);

    // P0 security fix: leaking which OAuth providers an account has is an
    // enumeration risk — the 409 body must never include a providers field.
    expect(res.status).toBe(409);
    expect(res.body.providers).toBeUndefined();
    expect(res.body.provider).toBeUndefined();
  });

  test('409 error message does not hint at which provider is registered', async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { status: 422, message: 'Email already registered' },
    });

    const res = await post(VALID_BODY);

    const body = JSON.stringify(res.body).toLowerCase();
    expect(body).not.toContain('google');
    expect(body).not.toContain('github');
    expect(body).not.toContain('oauth');
    expect(body).not.toContain('provider');
  });
});

// ---------------------------------------------------------------------------
// Supabase admin errors
// ---------------------------------------------------------------------------

describe('POST /api/auth/signup — Supabase errors', () => {
  test('returns 500 on non-422 Supabase error', async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { status: 500, message: 'Internal Supabase error' },
    });

    const res = await post(VALID_BODY);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('500 response does not expose raw Supabase error message', async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { status: 500, message: 'pg_hba.conf entry rejected connection' },
    });

    const res = await post(VALID_BODY);

    expect(res.status).toBe(500);
    const body = JSON.stringify(res.body).toLowerCase();
    expect(body).not.toContain('pg_hba');
    expect(body).not.toContain('postgres');
    expect(body).not.toContain('supabase');
  });

  test('returns 500 when createUser throws unexpectedly', async () => {
    mockCreateUser.mockRejectedValue(new Error('Network timeout'));

    const res = await post(VALID_BODY);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    // Must not expose the raw error message
    expect(res.body.error).not.toContain('Network timeout');
  });
});

// ---------------------------------------------------------------------------
// CSRF — public endpoint bypass
// ---------------------------------------------------------------------------

describe('POST /api/auth/signup — CSRF bypass', () => {
  test('succeeds without any CSRF token (public endpoint)', async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'uid' } }, error: null });

    // No X-CSRF-Token header or body._csrf — should still succeed
    const res = await request(app)
      .post('/api/auth/signup')
      .send(VALID_BODY);

    expect(res.status).toBe(201);
  });
});
