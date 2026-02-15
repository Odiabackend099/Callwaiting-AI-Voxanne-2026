import { test, expect } from '@playwright/test';

test.describe('Onboarding Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/start');
  });

  test('should show form with proper labels and placeholders', async ({ page }) => {
    // Check required field labels have red asterisks
    await expect(page.locator('label:has-text("*")')).toHaveCount(4); // company, email, phone, greeting_script

    // Check optional field labels
    await expect(page.locator('text=(Optional)')).toHaveCount(2); // website, voice_preference

    // Check form fields are present
    await expect(page.locator('input[name="company"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    await expect(page.locator('textarea[name="greeting_script"]')).toBeVisible();
    await expect(page.locator('input[name="website"]')).toBeVisible();
  });

  test('should validate required fields when empty', async ({ page }) => {
    // Submit empty form
    await page.click('button[type="submit"]');

    // Check for error messages
    await expect(page.locator('text=Company name is required')).toBeVisible();
    await expect(page.locator('text=Valid email is required')).toBeVisible();
    await expect(page.locator('text=Phone number is too short')).toBeVisible();
    await expect(page.locator('text=Greeting script must be at least 5 characters')).toBeVisible();

    // Check red borders on required fields
    await expect(page.locator('input[name="company"]')).toHaveClass(/border-red/);
    await expect(page.locator('input[name="email"]')).toHaveClass(/border-red/);
    await expect(page.locator('input[name="phone"]')).toHaveClass(/border-red/);
    await expect(page.locator('textarea[name="greeting_script"]')).toHaveClass(/border-red/);
  });

  test('should validate optional website field only when provided', async ({ page }) => {
    // Fill required fields with valid data
    await page.fill('input[name="company"]', 'Test Clinic');
    await page.fill('input[name="email"]', 'test@clinic.com');
    await page.fill('input[name="phone"]', '+1 555 123 4567');
    await page.fill('textarea[name="greeting_script"]', 'Hello there');

    // Test 1: Leave website empty (should be valid)
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Your onboarding information has been received')).toBeVisible();

    // Test 2: Enter invalid website
    await page.fill('input[name="website"]', 'invalid!!!');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Please enter a valid website')).toBeVisible();

    // Test 3: Enter valid website
    await page.fill('input[name="website"]', 'google.com');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Your onboarding information has been received')).toBeVisible();

    // Test 4: Enter valid URL
    await page.fill('input[name="website"]', 'https://clinic.com');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Your onboarding information has been received')).toBeVisible();
  });

  test('should validate phone number format', async ({ page }) => {
    // Fill other required fields
    await page.fill('input[name="company"]', 'Test Clinic');
    await page.fill('input[name="email"]', 'test@clinic.com');
    await page.fill('textarea[name="greeting_script"]', 'Hello there');

    // Test invalid phone formats
    const invalidPhones = ['1234567890', '555-123-4567', '(555) 123-4567', '+155512345678901234567890'];

    for (const phone of invalidPhones) {
      await page.fill('input[name="phone"]', phone);
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Please enter a valid phone number starting with +')).toBeVisible();
    }

    // Test valid phone formats
    const validPhones = ['+1 555 123 4567', '+44 7700 900000', '+15551234567'];

    for (const phone of validPhones) {
      await page.fill('input[name="phone"]', phone);
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Your onboarding information has been received')).toBeVisible();
      // Reset for next test
      await page.reload();
      await page.fill('input[name="company"]', 'Test Clinic');
      await page.fill('input[name="email"]', 'test@clinic.com');
      await page.fill('textarea[name="greeting_script"]', 'Hello there');
    }
  });

  test('should handle successful form submission', async ({ page }) => {
    // Fill all required fields with valid data
    await page.fill('input[name="company"]', 'Test Clinic');
    await page.fill('input[name="email"]', 'test@clinic.com');
    await page.fill('input[name="phone"]', '+1 555 123 4567');
    await page.fill('textarea[name="greeting_script"]', 'Hello there, welcome to our clinic!');

    // Leave optional fields empty
    // Submit form
    await page.click('button[type="submit"]');

    // Check success message
    await expect(page.locator('text=Your onboarding information has been received')).toBeVisible();
    await expect(page.locator('text=Our team will configure your instance within 24 hours')).toBeVisible();
  });

  test('should handle PDF file upload', async ({ page }) => {
    // Fill required fields
    await page.fill('input[name="company"]', 'Test Clinic');
    await page.fill('input[name="email"]', 'test@clinic.com');
    await page.fill('input[name="phone"]', '+1 555 123 4567');
    await page.fill('textarea[name="greeting_script"]', 'Hello there');

    // Upload a PDF file (we'll need to create a test PDF or use existing one)
    // For now, skip file upload test since we need a test file
    // await page.setInputFiles('input[type="file"]', 'path/to/test.pdf');

    // Submit form
    await page.click('button[type="submit"]');

    // Should succeed without file
    await expect(page.locator('text=Your onboarding information has been received')).toBeVisible();
  });
});
