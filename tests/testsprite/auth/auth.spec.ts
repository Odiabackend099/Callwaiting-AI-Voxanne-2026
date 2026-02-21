/**
 * TestSprite Test Suite: Authentication & Multi-Tenant Isolation
 *
 * Tests:
 * - User signup with auto-organization creation
 * - Login & session management
 * - Multi-tenant data isolation
 * - JWT authentication enforcement
 * - Session timeout handling
 *
 * Test Account: test@demo.com / demo123
 */

import { describe, it, beforeEach, afterEach } from '@testsprite/core';
import { expect } from '@testsprite/assertions';
import { TestContext, BrowserContext } from '@testsprite/types';

describe('Authentication', () => {
  let context: TestContext;
  let browser: BrowserContext;

  beforeEach(async () => {
    context = await TestSprite.createContext();
    browser = await context.newBrowser();
  });

  afterEach(async () => {
    await browser.close();
    await context.cleanup();
  });

  describe('User Signup', () => {
    it('should create new user and auto-create organization', async () => {
      const page = await browser.newPage();
      const testEmail = `test-${Date.now()}@testsprite.com`;

      // Navigate to signup page
      await page.goto('https://voxanne.ai/sign-up');

      // Fill signup form
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.fill('input[name="confirmPassword"]', 'TestPass123!');

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard
      await page.waitForNavigation({ timeout: 10000 });

      // Verify redirected to dashboard
      expect(page.url()).toContain('/dashboard');

      // Verify welcome banner exists
      await expect(page).toHaveElement('[data-testid="welcome-banner"]');

      // Verify organization created in database
      const dbResult = await context.database.query({
        sql: 'SELECT org_id FROM profiles WHERE email = $1',
        params: [testEmail]
      });

      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].org_id).toBeTruthy();

      // Verify organization exists
      const orgResult = await context.database.query({
        sql: 'SELECT id FROM organizations WHERE id = $1',
        params: [dbResult.rows[0].org_id]
      });

      expect(orgResult.rows).toHaveLength(1);

      // Take screenshot for visual verification
      await page.screenshot({
        path: './test-results/screenshots/signup-success.png',
        fullPage: true
      });
    });

    it('should reject signup with existing email', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-up');

      // Use existing test account email
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.fill('input[name="confirmPassword"]', 'TestPass123!');

      await page.click('button[type="submit"]');

      // Wait for error message
      await page.waitForSelector('.error-message', { timeout: 5000 });

      // Verify error message
      const errorText = await page.textContent('.error-message');
      expect(errorText).toContain('email already exists');
    });

    it('should enforce password strength requirements', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-up');

      const weakPasswords = [
        'weak',           // Too short
        '12345678',       // No letters
        'abcdefgh',       // No numbers
        'Password',       // No special chars
      ];

      for (const password of weakPasswords) {
        await page.fill('input[name="password"]', password);
        await page.fill('input[name="confirmPassword"]', password);

        // Check for password strength indicator
        const strengthIndicator = await page.textContent('.password-strength');
        expect(strengthIndicator).toContain('Weak');
      }
    });
  });

  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-in');

      // Fill login form
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');

      // Submit
      await page.click('button[type="submit"]');

      // Wait for dashboard
      await page.waitForNavigation({ timeout: 10000 });

      // Verify dashboard loaded
      expect(page.url()).toContain('/dashboard');

      // Verify user info displayed
      await expect(page).toHaveElement('[data-testid="user-menu"]');

      // Verify JWT token in cookies/localStorage
      const token = await page.evaluate(() => {
        return localStorage.getItem('supabase.auth.token') ||
               document.cookie.split(';').find(c => c.includes('auth-token'));
      });

      expect(token).toBeTruthy();
    });

    it('should reject login with invalid credentials', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-in');

      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'wrong-password');

      await page.click('button[type="submit"]');

      // Wait for error
      await page.waitForSelector('.error-message', { timeout: 5000 });

      const errorText = await page.textContent('.error-message');
      expect(errorText).toMatch(/invalid.*credentials/i);

      // Verify still on login page
      expect(page.url()).toContain('/sign-in');
    });

    it('should enforce rate limiting on failed login attempts', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-in');

      // Attempt 10 failed logins
      for (let i = 0; i < 10; i++) {
        await page.fill('input[name="email"]', 'test@demo.com');
        await page.fill('input[name="password"]', `wrong-password-${i}`);
        await page.click('button[type="submit"]');

        await page.waitForTimeout(1000);
      }

      // Next attempt should be rate limited
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'wrong-password-final');
      await page.click('button[type="submit"]');

      await page.waitForSelector('.error-message', { timeout: 5000 });

      const errorText = await page.textContent('.error-message');
      expect(errorText).toMatch(/too many.*attempts|rate limit/i);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should prevent User A from accessing User B data', async () => {
      // Create 2 test users
      const userA = await context.createTestUser({
        email: 'usera@testsprite.com',
        password: 'TestPass123!'
      });

      const userB = await context.createTestUser({
        email: 'userb@testsprite.com',
        password: 'TestPass123!'
      });

      // Create contact for User B
      const contactB = await context.database.insert({
        table: 'contacts',
        data: {
          org_id: userB.orgId,
          phone: '+15551234567',
          first_name: 'Secret',
          last_name: 'Contact',
          email: 'secret@contact.com'
        }
      });

      // Login as User A
      const pageA = await browser.newPage();
      await pageA.goto('https://voxanne.ai/sign-in');
      await pageA.fill('input[name="email"]', userA.email);
      await pageA.fill('input[name="password"]', 'TestPass123!');
      await pageA.click('button[type="submit"]');
      await pageA.waitForNavigation();

      // Attempt to access User B's contact
      const response = await pageA.goto(
        `/dashboard/contacts/${contactB.id}`
      );

      // Should return 404 (not found, not accessible)
      expect(response.status()).toBe(404);

      // Verify error message
      const bodyText = await pageA.textContent('body');
      expect(bodyText).toMatch(/not found|contact.*not.*exist/i);

      // Verify User A cannot see User B's contact in list
      await pageA.goto('/dashboard/contacts');
      await pageA.waitForSelector('.contacts-table', { timeout: 5000 });

      const contactNames = await pageA.$$eval('tbody tr', (rows) =>
        rows.map(row => row.textContent)
      );

      const hasSecretContact = contactNames.some(name =>
        name?.includes('Secret Contact')
      );

      expect(hasSecretContact).toBe(false);
    });

    it('should isolate API calls by org_id', async () => {
      const page = await browser.newPage();

      // Login as test@demo.com
      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Get JWT token
      const token = await page.evaluate(() => {
        const authData = localStorage.getItem('supabase.auth.token');
        return authData ? JSON.parse(authData).access_token : null;
      });

      // Make API call with valid token
      const response1 = await fetch('https://voxanneai.onrender.com/api/contacts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(response1.status).toBe(200);
      const contacts1 = await response1.json();

      // Verify all contacts belong to test org
      const testOrgId = await context.getTestOrgId();
      contacts1.forEach((contact: any) => {
        expect(contact.org_id).toBe(testOrgId);
      });

      // Attempt to manipulate org_id in header (should be ignored)
      const response2 = await fetch('https://voxanneai.onrender.com/api/contacts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-org-id': 'fake-org-id-12345'  // Should be ignored
        }
      });

      const contacts2 = await response2.json();

      // Should still return test org's contacts only
      expect(contacts1).toEqual(contacts2);
    });
  });

  describe('Session Management', () => {
    it('should maintain session across page refreshes', async () => {
      const page = await browser.newPage();

      // Login
      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Verify on dashboard
      expect(page.url()).toContain('/dashboard');

      // Refresh page
      await page.reload();

      // Should still be authenticated
      await page.waitForSelector('[data-testid="user-menu"]', { timeout: 5000 });
      expect(page.url()).toContain('/dashboard');
    });

    it('should redirect to login after session expires', async () => {
      const page = await browser.newPage();

      // Login
      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Manually expire JWT token
      await page.evaluate(() => {
        const authData = JSON.parse(localStorage.getItem('supabase.auth.token')!);
        authData.expires_at = Date.now() - 1000; // Expired 1 second ago
        localStorage.setItem('supabase.auth.token', JSON.stringify(authData));
      });

      // Navigate to protected page
      await page.goto('https://voxanne.ai/dashboard/call-logs');

      // Should redirect to login
      await page.waitForURL('**/sign-in', { timeout: 5000 });
      expect(page.url()).toContain('/sign-in');
    });

    it('should logout successfully', async () => {
      const page = await browser.newPage();

      // Login
      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Click logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      // Should redirect to landing page or login
      await page.waitForNavigation();
      expect(page.url()).toMatch(/\/(sign-in|$)/);

      // Verify token removed
      const token = await page.evaluate(() => {
        return localStorage.getItem('supabase.auth.token');
      });

      expect(token).toBeNull();

      // Attempt to access protected page
      await page.goto('https://voxanne.ai/dashboard');

      // Should redirect back to login
      await page.waitForURL('**/sign-in', { timeout: 5000 });
    });
  });

  describe('JWT Authentication', () => {
    it('should extract org_id from JWT app_metadata', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Decode JWT and verify org_id
      const orgIdFromJWT = await page.evaluate(() => {
        const authData = JSON.parse(localStorage.getItem('supabase.auth.token')!);
        const token = authData.access_token;

        // Decode JWT (basic base64 decode)
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));

        return payload.app_metadata?.org_id;
      });

      expect(orgIdFromJWT).toBeTruthy();

      // Verify matches database
      const testOrgId = await context.getTestOrgId();
      expect(orgIdFromJWT).toBe(testOrgId);
    });

    it('should reject requests with invalid JWT', async () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const response = await fetch('https://voxanneai.onrender.com/api/contacts', {
        headers: {
          'Authorization': `Bearer ${invalidToken}`
        }
      });

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toMatch(/unauthorized|invalid.*token/i);
    });

    it('should reject requests with missing JWT', async () => {
      const response = await fetch('https://voxanneai.onrender.com/api/contacts');

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toMatch(/unauthorized|authentication.*required/i);
    });
  });
});
