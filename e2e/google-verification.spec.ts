import { test, expect } from '@playwright/test';

test('Google Cloud Console App Verification', async ({ page }) => {
  // Login to Google Cloud Console
  await page.goto('https://console.cloud.google.com/');
  await page.fill('input[type="email"]', 'callwaitingai@gmail.com');
  await page.click('#identifierNext');
  await page.fill('input[type="password"]', process.env.GOOGLE_PASSWORD);
  await page.click('#passwordNext');

  // Navigate to OAuth consent screen
  await page.goto('https://console.cloud.google.com/apis/credentials/consent');
  
  // Configure app details
  await page.fill('input[name="appName"]', 'Call Waiting AI');
  await page.fill('input[name="supportEmail"]', 'callwaitingai@gmail.com');
  
  // Add authorized domains
  await page.click('button:has-text("Add domain")');
  await page.fill('input[placeholder="Domain"]', 'callwaitingai.dev');
  await page.click('button:has-text("Add")');
  
  // Add privacy policy and TOS URLs
  await page.fill('input[name="privacyPolicy"]', 'https://callwaitingai.dev/privacy-policy');
  await page.fill('input[name="tos"]', 'https://callwaitingai.dev/terms-of-service');
  
  // Submit for verification
  await page.click('button:has-text("Submit for verification")');
  
  // Verify submission success
  await expect(page.locator('text=Your verification request has been submitted')).toBeVisible();
});
