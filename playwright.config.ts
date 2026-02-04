import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 *
 * E2E testing for:
 * - Accessibility (WCAG 2.1 AA compliance)
 * - Keyboard shortcuts and interactions
 * - Edge case handling and state management
 *
 * Also supports nuclear integration tests for Hybrid Telephony feature:
 * - Full stack testing with mock server (no real Twilio calls)
 * - Database, API, and Frontend validation
 * - Rate limiting, GSM code generation, verification flows
 */

export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', '*nuclear*.test.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30000,

  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  //   webServer: [
  //     {
  //       command: 'npm run dev',
  //       url: 'http://localhost:3000',
  //       reuseExistingServer: !process.env.CI,
  //       timeout: 120000,
  //     },
  // Mock Telephony Server (only for nuclear tests)
  // {
  //   command: 'npx ts-node tests/mocks/mock-server.ts',
  //   url: 'http://localhost:3001/health',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 30000,
  //   env: {
  //     MOCK_SERVER_PORT: '3001',
  //     MOCK_LATENCY: '50',
  //     NODE_ENV: 'test',
  //   },
  // },
  //   ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
