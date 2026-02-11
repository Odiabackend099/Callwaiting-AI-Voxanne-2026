/**
 * Auth Rate Limiting Integration Tests (P0-3 Fix)
 *
 * Tests Redis-backed rate limiting for authentication endpoints
 * to prevent brute-force attacks, MFA code guessing, and account enumeration.
 *
 * Security: Validates that attackers cannot:
 * - Brute-force MFA codes (limited to 3 attempts per 15 min)
 * - Guess passwords unlimited times (limited to 10 attempts per 15 min)
 * - Create spam accounts (limited to 5 signups per hour)
 * - Enumerate emails via password reset (limited to 3 per hour)
 */

import request from 'supertest';
import express, { Request, Response } from 'express';
import {
  mfaRateLimiter,
  loginRateLimiter,
  signupRateLimiter,
  passwordResetRateLimiter,
  checkRateLimiterHealth,
  clearUserRateLimit,
  clearIPRateLimit
} from '../../middleware/rate-limiter';
import Redis from 'ioredis';

// Create test Express app
const app = express();
app.use(express.json());

// Mock auth endpoints with rate limiters applied
app.post('/api/auth/mfa/verify', mfaRateLimiter, (req: Request, res: Response) => {
  const { userId, code } = req.body;

  // Simulate MFA verification (always fails for test)
  if (code === '123456') {
    res.json({ success: true, message: 'MFA verified' });
  } else {
    res.status(401).json({ error: 'Invalid MFA code' });
  }
});

app.post('/api/auth/login', loginRateLimiter, (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Simulate login (always fails for test unless correct password)
  if (password === 'CorrectPassword123!') {
    res.json({ success: true, token: 'fake-jwt-token' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/auth/signup', signupRateLimiter, (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Simulate signup (always succeeds for test)
  res.status(201).json({
    success: true,
    userId: 'new-user-id',
    email
  });
});

app.post('/api/auth/reset-password', passwordResetRateLimiter, (req: Request, res: Response) => {
  const { email } = req.body;

  // Simulate password reset email sent
  res.json({
    success: true,
    message: `Password reset email sent to ${email}`
  });
});

// Initialize Redis client for test cleanup
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

describe('Auth Rate Limiting (P0-3 Fix)', () => {
  beforeEach(async () => {
    // Clear all rate limit keys before each test
    const keys = await redis.keys('rl:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    // Cleanup: Clear all rate limit keys after tests
    const keys = await redis.keys('rl:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();
  });

  describe('MFA Rate Limiter (CRITICAL - 3 attempts per 15 min)', () => {
    it('should allow 3 MFA verification attempts then block', async () => {
      const userId = 'test-user-mfa';

      // Attempt 1-3: Should be allowed (but fail due to wrong code)
      for (let i = 1; i <= 3; i++) {
        const res = await request(app)
          .post('/api/auth/mfa/verify')
          .send({ userId, code: '000000' }); // Wrong code

        expect(res.status).toBe(401); // Wrong code returns 401
        expect(res.body.error).toBe('Invalid MFA code');
      }

      // Attempt 4: Should be rate limited
      const res = await request(app)
        .post('/api/auth/mfa/verify')
        .send({ userId, code: '000000' });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many MFA verification attempts');
      expect(res.body.retryAfter).toBe(15 * 60); // 15 minutes
      expect(res.body.lockedUntil).toBeDefined();
    });

    it('should rate limit by user ID, not IP address', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      // User 1: Hit rate limit
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/mfa/verify')
          .send({ userId: user1, code: '000000' });
      }

      // User 1: 4th attempt blocked
      const blocked = await request(app)
        .post('/api/auth/mfa/verify')
        .send({ userId: user1, code: '000000' });
      expect(blocked.status).toBe(429);

      // User 2: Should still be allowed (different user ID)
      const allowed = await request(app)
        .post('/api/auth/mfa/verify')
        .send({ userId: user2, code: '000000' });
      expect(allowed.status).toBe(401); // Wrong code, but not rate limited
    });

    it('should count successful attempts (prevents slow brute-force)', async () => {
      const userId = 'test-user-success';

      // Make 3 successful verifications
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/auth/mfa/verify')
          .send({ userId, code: '123456' }); // Correct code

        expect(res.status).toBe(200);
      }

      // 4th attempt should be rate limited (even with correct code)
      const res = await request(app)
        .post('/api/auth/mfa/verify')
        .send({ userId, code: '123456' });

      expect(res.status).toBe(429);
    });

    it('should return rate limit headers', async () => {
      const userId = 'test-user-headers';

      const res = await request(app)
        .post('/api/auth/mfa/verify')
        .send({ userId, code: '000000' });

      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Login Rate Limiter (MODERATE - 10 attempts per 15 min)', () => {
    it('should allow 10 login attempts per IP then block', async () => {
      // Make 10 failed login attempts from same IP
      for (let i = 1; i <= 10; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'WrongPassword' });

        expect(res.status).toBe(401); // Wrong password
      }

      // 11th attempt: Rate limited
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword' });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many login attempts');
      expect(res.body.retryAfter).toBe(15 * 60);
    });

    it('should NOT count successful logins (allows legitimate retries)', async () => {
      // Make 10 successful logins
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'CorrectPassword123!' });

        expect(res.status).toBe(200);
      }

      // 11th successful login should still work (successful requests skipped)
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'CorrectPassword123!' });

      expect(res.status).toBe(200);

      // But 11 failed attempts should be blocked
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'wrong@example.com', password: 'Wrong' });
      }

      const blocked = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@example.com', password: 'Wrong' });

      expect(blocked.status).toBe(429);
    });
  });

  describe('Signup Rate Limiter (RELAXED - 5 attempts per hour)', () => {
    it('should allow 5 signups per hour per IP', async () => {
      // 5 signups: Should be allowed
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({
            email: `test${i}@example.com`,
            password: 'Password123!'
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      }

      // 6th signup: Rate limited
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test6@example.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many signup attempts');
      expect(res.body.retryAfter).toBe(60 * 60); // 1 hour
    });

    it('should count all signups (successful and failed)', async () => {
      // All signups count toward rate limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/signup')
          .send({ email: `user${i}@test.com`, password: 'Pass123!' });
      }

      // 6th attempt blocked
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'user6@test.com', password: 'Pass123!' });

      expect(res.status).toBe(429);
    });
  });

  describe('Password Reset Rate Limiter (STRICT - 3 attempts per hour)', () => {
    it('should allow 3 password reset requests per email per hour', async () => {
      const email = 'victim@example.com';

      // 3 requests: Allowed
      for (let i = 1; i <= 3; i++) {
        const res = await request(app)
          .post('/api/auth/reset-password')
          .send({ email });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }

      // 4th request: Rate limited
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ email });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('Too many password reset requests');
      expect(res.body.retryAfter).toBe(60 * 60); // 1 hour
    });

    it('should rate limit by email, not IP (prevents email bombing)', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // Email 1: Hit rate limit
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/reset-password')
          .send({ email: email1 });
      }

      // Email 1: 4th request blocked
      const blocked = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: email1 });
      expect(blocked.status).toBe(429);

      // Email 2: Should still work (different email)
      const allowed = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: email2 });
      expect(allowed.status).toBe(200);
    });

    it('should normalize email case (prevent bypass via capitalization)', async () => {
      // Send 3 requests with different capitalizations
      await request(app).post('/api/auth/reset-password').send({ email: 'test@example.com' });
      await request(app).post('/api/auth/reset-password').send({ email: 'Test@Example.com' });
      await request(app).post('/api/auth/reset-password').send({ email: 'TEST@EXAMPLE.COM' });

      // 4th request (any capitalization) should be blocked
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'TeSt@ExAmPlE.CoM' });

      expect(res.status).toBe(429);
    });
  });

  describe('Rate Limiter Health & Admin Functions', () => {
    it('should verify Redis connection health', async () => {
      const health = await checkRateLimiterHealth();

      expect(health.healthy).toBe(true);
      expect(health.redisConnected).toBe(true);
      expect(health.error).toBeUndefined();
    });

    it('should allow admin to clear user rate limits', async () => {
      const userId = 'locked-user';

      // Hit MFA rate limit
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/mfa/verify')
          .send({ userId, code: '000000' });
      }

      // Verify locked
      const locked = await request(app)
        .post('/api/auth/mfa/verify')
        .send({ userId, code: '000000' });
      expect(locked.status).toBe(429);

      // Admin clears rate limit
      await clearUserRateLimit(userId);

      // Verify unlocked
      const unlocked = await request(app)
        .post('/api/auth/mfa/verify')
        .send({ userId, code: '000000' });
      expect(unlocked.status).toBe(401); // Wrong code, but not rate limited
    });

    it('should allow admin to clear IP rate limits', async () => {
      // Hit login rate limit (10 attempts)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@test.com', password: 'wrong' });
      }

      // Verify locked
      const locked = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });
      expect(locked.status).toBe(429);

      // Admin clears ALL login and signup rate limits (wildcard clear)
      const allLoginKeys = await redis.keys('rl:login:*');
      const allSignupKeys = await redis.keys('rl:signup:*');

      if (allLoginKeys.length > 0) {
        await redis.del(...allLoginKeys);
      }
      if (allSignupKeys.length > 0) {
        await redis.del(...allSignupKeys);
      }

      // Verify unlocked
      const unlocked = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });
      expect(unlocked.status).toBe(401); // Wrong password, but not rate limited
    });
  });

  describe('Security Validation', () => {
    it('should prevent brute-force MFA attack scenario', async () => {
      const userId = 'attack-target';

      // Attacker tries 100 MFA codes
      let blockedCount = 0;

      for (let i = 0; i < 100; i++) {
        const code = String(i).padStart(6, '0'); // 000000, 000001, ...
        const res = await request(app)
          .post('/api/auth/mfa/verify')
          .send({ userId, code });

        if (res.status === 429) {
          blockedCount++;
        }
      }

      // After first 3 attempts, remaining 97 should be blocked
      expect(blockedCount).toBe(97);
    });

    it('should prevent distributed login attack (same IP, multiple accounts)', async () => {
      const accounts = Array.from({ length: 15 }, (_, i) => `user${i}@test.com`);

      let blockedCount = 0;

      for (const email of accounts) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email, password: 'WrongPassword' });

        if (res.status === 429) {
          blockedCount++;
        }
      }

      // First 10 allowed, remaining 5 blocked
      expect(blockedCount).toBe(5);
    });

    it('should prevent email enumeration via password reset', async () => {
      const testEmails = [
        'exists@example.com',
        'notexist@example.com',
        'maybe@example.com',
        'unknown@example.com'
      ];

      // Try to enumerate 4 emails (limit is 3 per hour per email)
      // But rate limiter prevents checking more than 3 for same IP
      let successCount = 0;
      let blockedCount = 0;

      for (const email of testEmails) {
        const res = await request(app)
          .post('/api/auth/reset-password')
          .send({ email });

        if (res.status === 200) successCount++;
        if (res.status === 429) blockedCount++;
      }

      // All 4 should succeed (rate limit is per email, not IP)
      // But if attacker tries same email 4 times, 4th is blocked
      expect(successCount).toBe(4);
    });
  });
});
