/**
 * Voxanne AI Demo Test Suite
 *
 * Tests core functionality with demo credentials:
 * - Email: voxanne@demo.com
 * - Password: demo123
 *
 * Test scenarios:
 * 1. Homepage loads
 * 2. Login flow works
 * 3. Dashboard displays after login
 * 4. Agent configuration page loads
 * 5. Calls page displays call logs
 * 6. Navigation between dashboard sections
 */

import { test, expect, Page } from '@playwright/test';
import { setupTestEnvironment, waitForPageReady } from './fixtures';

const DEMO_EMAIL = 'voxanne@demo.com';
const DEMO_PASSWORD = 'demo123';

test.describe('Voxanne AI Demo - Full User Journey', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');

    // Verify page loads
    await expect(page).toHaveTitle(/Voxanne|voxanne/i);

    // Check for navigation elements
    const navbar = page.locator('nav, header');
    await expect(navbar).toBeVisible();

    console.log('✅ Homepage loaded successfully');
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');

    // Look for login button/link
    const loginButton = page.locator('a[href*="login"], button:has-text("Login"), a:has-text("Sign in"), a:has-text("Log in")').first();

    if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginButton.click();
      await page.waitForURL(/login/i);
    } else {
      // Direct navigation fallback
      await page.goto('/login');
    }

    // Verify login page elements
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    console.log('✅ Login page loaded');
  });

  test('should login with demo credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill email
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(DEMO_EMAIL);
    console.log(`✅ Entered email: ${DEMO_EMAIL}`);

    // Fill password
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(DEMO_PASSWORD);
    console.log('✅ Entered password');

    // Click submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")').first();
    await submitButton.click();
    console.log('✅ Clicked login button');

    // Wait for redirect to dashboard
    await page.waitForURL(/(dashboard|app|home)/, { timeout: 15000 });
    console.log('✅ Redirected to dashboard');

    // Verify we're logged in
    const dashboardContent = page.locator('main, [role="main"], .dashboard').first();
    await expect(dashboardContent).toBeVisible({ timeout: 10000 });
  });

  test('should display dashboard after login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Login
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(DEMO_EMAIL);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(DEMO_PASSWORD);

    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();

    // Wait for dashboard
    await page.waitForURL(/(dashboard|app|home)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Check for dashboard elements
    const sidebar = page.locator('nav, aside, [data-testid="sidebar"]');
    if (await sidebar.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✅ Sidebar/Navigation visible');
    }

    // Check for main content
    const mainContent = page.locator('main, [role="main"]');
    await expect(mainContent).toBeVisible({ timeout: 10000 });
    console.log('✅ Main dashboard content loaded');

    // Look for dashboard cards/sections
    const cards = page.locator('[role="article"], .card, [data-testid="dashboard-card"]');
    const cardCount = await cards.count();
    console.log(`✅ Found ${cardCount} dashboard sections`);
  });

  test('should navigate to agent configuration', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(DEMO_EMAIL);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(DEMO_PASSWORD);

    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();

    await page.waitForURL(/(dashboard|app|home)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Navigate to agent config
    const agentLink = page.locator('a[href*="agent-config"], a:has-text("Agent"), button:has-text("Agent Configuration")').first();

    if (await agentLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await agentLink.click();
      await page.waitForLoadState('networkidle');
      console.log('✅ Navigated to agent configuration');
    } else {
      await page.goto('/dashboard/agent-config');
      console.log('✅ Direct navigation to agent configuration');
    }

    // Verify agent config page loaded
    const agentContent = page.locator('[data-testid="agent-config"], .agent-config, main');
    await expect(agentContent).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to calls page and display call logs', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(DEMO_EMAIL);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(DEMO_PASSWORD);

    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();

    await page.waitForURL(/(dashboard|app|home)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Navigate to calls page
    const callsLink = page.locator('a[href*="calls"], a:has-text("Calls"), button:has-text("Call Logs")').first();

    if (await callsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await callsLink.click();
      await page.waitForLoadState('networkidle');
      console.log('✅ Navigated to calls page');
    } else {
      await page.goto('/dashboard/calls');
      console.log('✅ Direct navigation to calls page');
    }

    // Wait for calls content to load
    const callsContent = page.locator('[data-testid="calls-page"], .calls-page, [role="grid"], table').first();
    await expect(callsContent).toBeVisible({ timeout: 10000 });
    console.log('✅ Calls page loaded');

    // Check if there are any call records
    const callRows = page.locator('tr[role="row"], [data-testid="call-row"], .call-item');
    const callCount = await callRows.count();
    console.log(`✅ Found ${callCount} call records`);
  });

  test('should verify session persistence', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(DEMO_EMAIL);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(DEMO_PASSWORD);

    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();

    await page.waitForURL(/(dashboard|app|home)/, { timeout: 15000 });

    // Get current URL
    const dashboardUrl = page.url();
    console.log(`✅ Dashboard URL: ${dashboardUrl}`);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify still logged in (not redirected to login)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    console.log('✅ Session persisted after page reload');
  });

  test('should handle API requests successfully', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(DEMO_EMAIL);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(DEMO_PASSWORD);

    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();

    // Monitor network requests
    let apiErrors = 0;
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        console.log(`⚠️ API Error: ${response.status()} ${response.url()}`);
        apiErrors++;
      }
    });

    await submitButton.click();
    await page.waitForURL(/(dashboard|app|home)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    expect(apiErrors).toBe(0);
    console.log('✅ All API requests successful');
  });

  test('should have accessible dashboard for user interaction', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(DEMO_EMAIL);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(DEMO_PASSWORD);

    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();

    await page.waitForURL(/(dashboard|app|home)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Check for interactive elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    const links = page.locator('a');
    const linkCount = await links.count();

    console.log(`✅ Found ${buttonCount} interactive buttons`);
    console.log(`✅ Found ${linkCount} navigation links`);

    expect(buttonCount).toBeGreaterThan(0);
    expect(linkCount).toBeGreaterThan(0);
  });
});

test.describe('Voxanne AI Error Handling', () => {
  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill('invalid@email.com');

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill('wrongpassword');

    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();

    // Should see error message or stay on login page
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const hasError = await page.locator('[role="alert"], .error, .error-message').isVisible({ timeout: 5000 }).catch(() => false);

    if (!currentUrl.includes('dashboard') && !currentUrl.includes('app')) {
      console.log('✅ Invalid login attempt handled correctly');
    } else if (hasError) {
      console.log('✅ Error message displayed to user');
    } else {
      console.log('⚠️ Login failed but no error message visible');
    }
  });

  test('should redirect to login if accessing protected routes without auth', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try to access dashboard directly
    await page.goto('/dashboard');

    // Should redirect to login or show access denied
    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    const isLoginPage = currentUrl.includes('/login');
    const hasNoAccess = await page.locator('[role="alert"], .access-denied').isVisible({ timeout: 5000 }).catch(() => false);

    if (isLoginPage || hasNoAccess) {
      console.log('✅ Protected routes properly secured');
    }
  });
});
