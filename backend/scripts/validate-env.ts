/**
 * Backend Environment Validation Script
 *
 * Pre-flight checks before backend startup to catch configuration issues early.
 * Run this script before deploying or starting the backend to ensure all
 * critical environment variables are properly configured.
 *
 * Usage:
 *   npm run validate-env
 *
 * Exit Codes:
 *   0 - All validation checks passed
 *   1 - One or more critical checks failed
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Validation result tracking
let criticalFailures = 0;
let warnings = 0;
let passes = 0;

/**
 * Print colored console output
 */
function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  passes++;
  log(colors.green, `✅ ${message}`);
}

function logWarning(message: string) {
  warnings++;
  log(colors.yellow, `⚠️  ${message}`);
}

function logError(message: string) {
  criticalFailures++;
  log(colors.red, `❌ ${message}`);
}

function logInfo(message: string) {
  log(colors.cyan, `ℹ️  ${message}`);
}

function logHeader(message: string) {
  console.log('');
  log(colors.bright + colors.blue, '='.repeat(80));
  log(colors.bright + colors.blue, message);
  log(colors.bright + colors.blue, '='.repeat(80));
}

/**
 * Check 1: ENCRYPTION_KEY Format Validation
 */
function validateEncryptionKey(): void {
  logHeader('CHECK 1: ENCRYPTION_KEY Validation');

  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    logError('ENCRYPTION_KEY: Missing');
    logInfo('Fix: Generate with: openssl rand -hex 32');
    return;
  }

  if (key === 'your-256-bit-hex-key-here') {
    logError('ENCRYPTION_KEY: Placeholder detected');
    logInfo('Fix: Generate with: openssl rand -hex 32');
    return;
  }

  // Check if 64-character hexadecimal
  const hex64Pattern = /^[0-9a-f]{64}$/i;
  if (hex64Pattern.test(key)) {
    logSuccess('ENCRYPTION_KEY: Valid 64-character hex format');
    logInfo(`Key preview: ${key.substring(0, 16)}...${key.substring(key.length - 16)}`);
  } else {
    logWarning('ENCRYPTION_KEY: Not 64-char hex (will be SHA-256 hashed)');
    logInfo(`Key length: ${key.length} characters`);
    logInfo('This is acceptable but 64-char hex is recommended');
  }
}

/**
 * Check 2: Twilio Master Credentials Validation
 */
async function validateTwilioMasterCredentials(): Promise<void> {
  logHeader('CHECK 2: Twilio Master Credentials Validation');

  const masterSid = process.env.TWILIO_MASTER_ACCOUNT_SID;
  const masterToken = process.env.TWILIO_MASTER_AUTH_TOKEN;

  if (!masterSid || !masterToken) {
    logInfo('TWILIO_MASTER_*: Not configured — telephony provisioning disabled');
    logInfo('Set TWILIO_MASTER_ACCOUNT_SID and TWILIO_MASTER_AUTH_TOKEN in Render to enable provisioning');
    logInfo('Existing orgs with credentials in database continue to work normally');
    return;
  }

  // Validate format — informational only.
  // BYOC architecture: master creds are for provisioning only (optional feature).
  // Wrong format = provisioning will fail at runtime, but server starts normally.
  const sidFormatOk = masterSid.startsWith('AC') && masterSid.length === 34;
  const tokenFormatOk = masterToken.length === 32;

  if (sidFormatOk) {
    logSuccess(`TWILIO_MASTER_ACCOUNT_SID: Valid format (${masterSid.substring(0, 10)}...)`);
  } else {
    logInfo(`TWILIO_MASTER_ACCOUNT_SID: Non-standard format — provisioning may fail`);
    logInfo(`Current: ${masterSid.substring(0, 10)}... (expected: AC + 32 hex chars, 34 total)`);
  }

  if (tokenFormatOk) {
    logSuccess(`TWILIO_MASTER_AUTH_TOKEN: Valid format (${masterToken.substring(0, 8)}...)`);
  } else {
    logInfo(`TWILIO_MASTER_AUTH_TOKEN: Non-standard length (${masterToken.length} chars, expected 32) — provisioning may fail`);
  }

  // Connectivity test removed: format check is sufficient.
  // Provisioning errors surface at runtime with clear Twilio API error messages.
}

// CHECK 3 REMOVED: Per-org Twilio SMS credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_PHONE_NUMBER) are NOT server-level env vars. In BYOC architecture, each org's
// Twilio subaccount credentials are stored encrypted in the org_credentials database table.
// Only TWILIO_MASTER_* credentials belong as server env vars (validated in CHECK 2).

/**
 * Check 4: Vapi Credentials Validation
 */
function validateVapiCredentials(): void {
  logHeader('CHECK 4: Vapi Credentials Validation');

  const privateKey = process.env.VAPI_PRIVATE_KEY;
  const publicKey = process.env.VAPI_PUBLIC_KEY;

  if (!privateKey) {
    logError('VAPI_PRIVATE_KEY: Missing (required for backend)');
    logInfo('Get from: https://vapi.ai/dashboard/settings/api-keys');
    return;
  }

  // UUID format validation (Vapi keys are UUIDs)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidPattern.test(privateKey)) {
    logSuccess('VAPI_PRIVATE_KEY: Valid UUID format');
    logInfo(`Key preview: ${privateKey.substring(0, 13)}...`);
  } else {
    logError('VAPI_PRIVATE_KEY: Invalid UUID format');
    logInfo('Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    return;
  }

  if (publicKey) {
    if (uuidPattern.test(publicKey)) {
      logSuccess('VAPI_PUBLIC_KEY: Valid UUID format (optional)');
    } else {
      logWarning('VAPI_PUBLIC_KEY: Invalid UUID format');
    }
  } else {
    logInfo('VAPI_PUBLIC_KEY: Not set (optional for frontend SDK)');
  }
}

/**
 * Check 5: Supabase Configuration Validation
 */
async function validateSupabaseConfiguration(): Promise<void> {
  logHeader('CHECK 5: Supabase Configuration Validation');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    logError('SUPABASE_URL: Missing');
    return;
  }

  if (!serviceRoleKey) {
    logError('SUPABASE_SERVICE_ROLE_KEY: Missing');
    return;
  }

  // Validate URL format
  try {
    const url = new URL(supabaseUrl);
    if (!url.hostname.includes('supabase.co')) {
      logWarning('SUPABASE_URL: Not a standard Supabase domain');
    } else {
      logSuccess(`SUPABASE_URL: Valid (${url.hostname})`);
    }
  } catch {
    logError('SUPABASE_URL: Invalid URL format');
    return;
  }

  // Validate service role key (should be JWT)
  if (!serviceRoleKey.startsWith('eyJ')) {
    logError('SUPABASE_SERVICE_ROLE_KEY: Invalid JWT format (should start with eyJ)');
    return;
  }

  logSuccess('SUPABASE_SERVICE_ROLE_KEY: Valid JWT format');
  logInfo(`Key preview: ${serviceRoleKey.substring(0, 20)}...`);

  // Test connection
  try {
    logInfo('Testing Supabase connection...');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.from('organizations').select('id').limit(1);

    if (error) {
      logError(`Supabase connection: Query failed`);
      logInfo(`Error: ${error.message}`);
    } else {
      logSuccess('Supabase connection: Successful');
      logInfo(`Found ${data?.length || 0} organization(s) in database`);
    }
  } catch (error: any) {
    logError(`Supabase connection: Failed`);
    logInfo(`Error: ${error.message}`);
  }
}

/**
 * Check 6: Encryption Round-Trip Test
 */
async function validateEncryption(): Promise<void> {
  logHeader('CHECK 6: Encryption Round-Trip Test');

  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    logError('ENCRYPTION_KEY: Missing - skipping encryption test');
    return;
  }

  try {
    logInfo('Testing encryption/decryption...');

    // Dynamically import EncryptionService
    const { EncryptionService } = await import('../src/services/encryption');

    const testData = { test: 'credential', value: 12345 };
    const plaintext = JSON.stringify(testData);

    // Encrypt
    const encrypted = EncryptionService.encrypt(plaintext);
    logInfo(`Encrypted: ${encrypted.substring(0, 40)}...`);

    // Decrypt
    const decrypted = EncryptionService.decrypt(encrypted);
    const parsed = JSON.parse(decrypted);

    // Verify
    if (parsed.test === 'credential' && parsed.value === 12345) {
      logSuccess('Encryption round-trip: Successful');
      logInfo('Credentials can be encrypted and decrypted correctly');
    } else {
      logError('Encryption round-trip: Data mismatch');
      logInfo(`Expected: ${plaintext}`);
      logInfo(`Got: ${decrypted}`);
    }
  } catch (error: any) {
    logError(`Encryption round-trip: Failed`);
    logInfo(`Error: ${error.message}`);
    logInfo('Check that ENCRYPTION_KEY is correctly formatted');
  }
}

/**
 * Check 7: Redis Configuration (Optional)
 */
function validateRedisConfiguration(): void {
  logHeader('CHECK 7: Redis Configuration (Optional)');

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logWarning('REDIS_URL: Not configured (webhook queue disabled)');
    logInfo('Required for: Webhook retry, job queues, caching');
    logInfo('Default: redis://localhost:6379');
    return;
  }

  try {
    const url = new URL(redisUrl);
    logSuccess(`REDIS_URL: Valid format (${url.host})`);

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      logInfo('Redis: Local instance (ensure Redis server is running)');
    } else {
      logInfo('Redis: Remote instance (cloud service)');
    }
  } catch {
    logError('REDIS_URL: Invalid URL format');
  }
}

/**
 * Check 8: Environment-Specific Warnings
 */
function validateEnvironmentSpecific(): void {
  logHeader('CHECK 8: Environment-Specific Configuration');

  const nodeEnv = process.env.NODE_ENV || 'development';
  const backendUrl = process.env.BACKEND_URL;

  logInfo(`NODE_ENV: ${nodeEnv}`);

  if (nodeEnv === 'production') {
    logInfo('Production mode detected - validating production requirements...');

    if (!backendUrl) {
      logWarning('BACKEND_URL: Not set (required for webhooks in production)');
    } else if (backendUrl.includes('ngrok') || backendUrl.includes('localhost')) {
      logError('BACKEND_URL: Development URL detected in production!');
      logInfo('Use production domain (e.g., https://api.voxanne.ai)');
    } else {
      logSuccess(`BACKEND_URL: Valid production URL (${backendUrl})`);
    }

    // Check for dev-only variables
    if (process.env.DEV_JWT_TOKEN) {
      logWarning('DEV_JWT_TOKEN: Development variable set in production');
    }
  } else {
    logInfo('Development mode - some checks relaxed');

    if (backendUrl?.includes('ngrok')) {
      logSuccess('BACKEND_URL: ngrok detected (acceptable for dev)');
    }
  }
}

/**
 * Print final summary
 */
function printSummary(): void {
  console.log('');
  logHeader('VALIDATION SUMMARY');

  console.log('');
  log(colors.green, `✅ Passed: ${passes}`);
  log(colors.yellow, `⚠️  Warnings: ${warnings}`);
  log(colors.red, `❌ Critical Failures: ${criticalFailures}`);
  console.log('');

  if (criticalFailures > 0) {
    log(colors.bright + colors.red, '🔴 VALIDATION FAILED');
    console.log('');
    logInfo('Fix critical errors above before starting backend');
    logInfo('Reference: CONFIGURATION_CRITICAL_INVARIANTS.md');
    console.log('');
    process.exit(1);
  } else if (warnings > 0) {
    log(colors.bright + colors.yellow, '⚠️  VALIDATION PASSED WITH WARNINGS');
    console.log('');
    logInfo('Backend can start, but warnings should be addressed');
    logInfo('Some features may be disabled (managed telephony, Redis queues)');
    console.log('');
    process.exit(0);
  } else {
    log(colors.bright + colors.green, '🎉 ALL VALIDATION CHECKS PASSED');
    console.log('');
    logInfo('Backend is ready to start!');
    logInfo('Run: npm run dev');
    console.log('');
    process.exit(0);
  }
}

/**
 * Main validation flow
 */
async function main() {
  logHeader('VOXANNE AI BACKEND - ENVIRONMENT VALIDATION');
  logInfo('Validating backend configuration before startup...');
  logInfo('Reference: CONFIGURATION_CRITICAL_INVARIANTS.md');

  // Run all checks
  validateEncryptionKey();
  await validateTwilioMasterCredentials();
  // CHECK 3 removed: per-org Twilio creds are in org_credentials DB table, not env vars
  validateVapiCredentials();
  await validateSupabaseConfiguration();
  await validateEncryption();
  validateRedisConfiguration();
  validateEnvironmentSpecific();

  // Print summary
  printSummary();
}

// Run validation
main().catch((error) => {
  console.error('');
  logError('Unexpected error during validation:');
  console.error(error);
  process.exit(1);
});
