/**
 * ================================================================================
 * CENTRALIZED ENVIRONMENT CONFIGURATION - SINGLE SOURCE OF TRUTH
 * ================================================================================
 *
 * This module loads and validates all environment variables from a single location.
 * This eliminates duplicate loading, ensures consistency, and provides a central
 * place to access all configuration.
 *
 * IMPORTANT: This file MUST be imported BEFORE any other modules in server.ts
 *
 * ⚠️ CRITICAL CONFIGURATION RULES:
 * Before modifying this file, read: CONFIGURATION_CRITICAL_INVARIANTS.md
 * - 7 rules that MUST NOT be broken
 * - ENCRYPTION_KEY requirements (Section 3)
 * - Startup validation rules (Section 5)
 * - Master credentials usage (Section 4)
 *
 * Usage:
 *   import { config } from './config';
 *
 *   // Access any configuration variable
 *   console.log(config.PORT);
 *   console.log(config.TWILIO_PHONE_NUMBER);
 *
 * Reference: CONFIGURATION_CRITICAL_INVARIANTS.md
 */

// Load environment variables FIRST
// @ts-ignore
const path = require('path');
// @ts-ignore
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

/**
 * Validates that a required environment variable exists
 * Throws error if missing, allowing fast failure at startup
 */
function getRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Reference: /.env.template for complete configuration guide.`
    );
  }
  return value;
}

/**
 * Gets an optional environment variable with a default
 */
function getOptional(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

/**
 * Converts string to boolean
 */
function getBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Converts string to number
 */
function getNumber(key: string, defaultValue?: number): number | undefined {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  if (isNaN(num)) throw new Error(`Invalid number for ${key}: ${value}`);
  return num;
}

/**
 * CENTRALIZED CONFIGURATION OBJECT
 * Single source of truth for all environment variables
 */
export const config = {
  // ========================================================================
  // CORE APPLICATION SETTINGS
  // ========================================================================
  NODE_ENV: getOptional('NODE_ENV', 'development'),
  PORT: getNumber('PORT', 5002),
  LOG_LEVEL: getOptional('LOG_LEVEL', 'info'),
  COMPANY_NAME: getOptional('COMPANY_NAME', 'CallWaiting AI'),
  CLINIC_NAME: getOptional('CLINIC_NAME', 'VoxAnne'),

  // ========================================================================
  // SUPABASE CONFIGURATION
  // ========================================================================
  SUPABASE_URL: getRequired('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY:
    getOptional('SUPABASE_SERVICE_ROLE_KEY') ||
    getOptional('SUPABASE_SERVICE_KEY'), // Support both names
  SUPABASE_FETCH_TIMEOUT_MS: getNumber('SUPABASE_FETCH_TIMEOUT_MS', 8000),

  // ========================================================================
  // BACKEND URLS
  // ========================================================================
  BACKEND_URL: getOptional('BACKEND_URL', 'http://localhost:5002'),
  FRONTEND_URL: getOptional('FRONTEND_URL', 'http://localhost:5001'),
  CORS_ORIGIN: getOptional('CORS_ORIGIN', 'http://localhost:5001'),
  WEBHOOK_URL: getOptional('WEBHOOK_URL'),

  // ========================================================================
  // TWILIO SMS SERVICE - APPROVED PRODUCTION CREDENTIALS
  // ========================================================================
  // ========================================================================
  // TWILIO SMS SERVICE - APPROVED PRODUCTION CREDENTIALS
  // ========================================================================
  // REQUIRED: Critical for managed telephony (provisioning Vapi numbers for clients)
  TWILIO_ACCOUNT_SID: getRequired('TWILIO_ACCOUNT_SID'),
  TWILIO_AUTH_TOKEN: getRequired('TWILIO_AUTH_TOKEN'),
  TWILIO_PHONE_NUMBER: getRequired('TWILIO_PHONE_NUMBER'),
  TWILIO_WHATSAPP_NUMBER: getOptional('TWILIO_WHATSAPP_NUMBER'),

  // ========================================================================
  // VAPI VOICE AI SERVICE - APPROVED PRODUCTION CREDENTIALS
  // ========================================================================
  VAPI_PRIVATE_KEY: getRequired('VAPI_PRIVATE_KEY'),
  VAPI_PUBLIC_KEY: getOptional('VAPI_PUBLIC_KEY'),
  VAPI_PHONE_NUMBER_ID: getOptional('VAPI_PHONE_NUMBER_ID'),
  VAPI_ASSISTANT_ID: getOptional('VAPI_ASSISTANT_ID'),
  VAPI_WEBHOOK_SECRET: getOptional('VAPI_WEBHOOK_SECRET'),

  // ========================================================================
  // GOOGLE OAUTH - CALENDAR INTEGRATION
  // ========================================================================
  // NOW OPTIONAL: Fetched per-tenant from DB in multi-tenant mode
  GOOGLE_CLIENT_ID: getOptional('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: getOptional('GOOGLE_CLIENT_SECRET'),
  GOOGLE_ENCRYPTION_KEY: getOptional('GOOGLE_ENCRYPTION_KEY'),
  GOOGLE_REDIRECT_URI: getOptional('GOOGLE_REDIRECT_URI'),

  // ========================================================================
  // STRIPE BILLING (Optional)
  // ========================================================================
  STRIPE_SECRET_KEY: getOptional('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: getOptional('STRIPE_WEBHOOK_SECRET'),
  STRIPE_STARTER_PRICE_ID: getOptional('STRIPE_STARTER_PRICE_ID'),
  STRIPE_STARTER_OVERAGE_PRICE_ID: getOptional('STRIPE_STARTER_OVERAGE_PRICE_ID'),
  STRIPE_STARTER_SETUP_PRICE_ID: getOptional('STRIPE_STARTER_SETUP_PRICE_ID'),
  STRIPE_PROFESSIONAL_PRICE_ID: getOptional('STRIPE_PROFESSIONAL_PRICE_ID'),
  STRIPE_PROFESSIONAL_OVERAGE_PRICE_ID: getOptional('STRIPE_PROFESSIONAL_OVERAGE_PRICE_ID'),
  STRIPE_PROFESSIONAL_SETUP_PRICE_ID: getOptional('STRIPE_PROFESSIONAL_SETUP_PRICE_ID'),
  STRIPE_ENTERPRISE_PRICE_ID: getOptional('STRIPE_ENTERPRISE_PRICE_ID'),
  STRIPE_ENTERPRISE_OVERAGE_PRICE_ID: getOptional('STRIPE_ENTERPRISE_OVERAGE_PRICE_ID'),
  STRIPE_ENTERPRISE_SETUP_PRICE_ID: getOptional('STRIPE_ENTERPRISE_SETUP_PRICE_ID'),

  // ========================================================================
  // OPENAI (Optional)
  // ========================================================================
  OPENAI_API_KEY: getOptional('OPENAI_API_KEY'),

  // ========================================================================
  // EMAIL SERVICE (Optional)
  // ========================================================================
  RESEND_API_KEY: getOptional('RESEND_API_KEY'),
  FROM_EMAIL: getOptional('FROM_EMAIL'),
  SMTP_HOST: getOptional('SMTP_HOST'),
  SMTP_PORT: getNumber('SMTP_PORT', 587),
  SMTP_USER: getOptional('SMTP_USER'),
  SMTP_PASSWORD: getOptional('SMTP_PASSWORD'),

  // ========================================================================
  // MONITORING & ERROR TRACKING
  // ========================================================================
  SENTRY_DSN: getOptional('SENTRY_DSN'),

  // ========================================================================
  // WEBSOCKET & REAL-TIME
  // ========================================================================
  WS_URL: getOptional('WS_URL'),
  WS_MAX_BUFFERED_BYTES: getNumber('WS_MAX_BUFFERED_BYTES', 1000000),
  ALLOW_DEV_WS_BYPASS: getBoolean('ALLOW_DEV_WS_BYPASS', false),

  // ========================================================================
  // RECORDING & MEDIA
  // ========================================================================
  RECORDING_URL_EXPIRY_SECONDS: getNumber('RECORDING_URL_EXPIRY_SECONDS', 3600),
  RECORDING_DOWNLOAD_TIMEOUT_MS: getNumber('RECORDING_DOWNLOAD_TIMEOUT_MS', 30000),

  // ========================================================================
  // ENCRYPTION
  // ========================================================================
  ENCRYPTION_KEY: getRequired('ENCRYPTION_KEY'), // REQUIRED: Master key for decrypting tenant credentials
  USE_SUPABASE_VAULT: getBoolean('USE_SUPABASE_VAULT', false),

  // ========================================================================
  // DEVELOPMENT VARIABLES (Local dev only - NEVER in production)
  // ========================================================================
  DEV_JWT_TOKEN: getOptional('DEV_JWT_TOKEN'),
  DEV_USER_ID: getOptional('DEV_USER_ID'),
  DEV_USER_EMAIL: getOptional('DEV_USER_EMAIL'),

  // ========================================================================
  // DEBUG FLAGS
  // ========================================================================
  DEBUG_VAPI: getBoolean('DEBUG_VAPI', false),
  DEBUG_WEBSOCKET: getBoolean('DEBUG_WEBSOCKET', false),
  DEBUG_WEB_VOICE_BRIDGE: getBoolean('DEBUG_WEB_VOICE_BRIDGE', false),
  EXPOSE_DEBUG_INFO: getBoolean('EXPOSE_DEBUG_INFO', false),

  // ========================================================================
  // DEPLOYMENT-SPECIFIC (Auto-populated on Render, etc.)
  // ========================================================================
  RENDER_EXTERNAL_URL: getOptional('RENDER_EXTERNAL_URL'),

  // ========================================================================
  // SUPABASE FRONTEND PUBLIC KEYS (For reference/validation)
  // ========================================================================
  NEXT_PUBLIC_SUPABASE_URL: getOptional('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getOptional('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  NEXT_PUBLIC_BACKEND_URL: getOptional('NEXT_PUBLIC_BACKEND_URL'),
  NEXT_PUBLIC_APP_URL: getOptional('NEXT_PUBLIC_APP_URL'),

  // ========================================================================
  // INTERNAL API KEY (for inter-service communication)
  // ========================================================================
  INTERNAL_API_KEY: getOptional('INTERNAL_API_KEY'),

  // ========================================================================
  // WALLET / PREPAID BILLING (Optional)
  // ========================================================================
  WALLET_MIN_TOPUP_PENCE: getNumber('WALLET_MIN_TOPUP_PENCE', 2500),       // £25 minimum top-up
  USD_TO_GBP_RATE: getOptional('USD_TO_GBP_RATE', '0.79'),                  // Vapi costs in USD

  // Fixed-rate billing configuration
  RATE_PER_MINUTE_USD_CENTS: getNumber('RATE_PER_MINUTE_USD_CENTS', 70),   // Fixed client rate ($0.70/min)
  CREDITS_PER_MINUTE: getNumber('CREDITS_PER_MINUTE', 10),                 // 10 credits = 1 minute (display ratio)
  WALLET_LOW_BALANCE_WARNING_CENTS: getNumber('WALLET_LOW_BALANCE_WARNING_CENTS', 1400), // $14.00 = ~200 credits remaining
  WALLET_MIN_BALANCE_USD_CENTS: getNumber('WALLET_MIN_BALANCE_USD_CENTS', 100), // $1.00 hard stop

  // Convert $1.00 hard stop to pence equivalent (derived from USD constant)
  WALLET_MIN_BALANCE_FOR_CALL: Math.ceil(
    getNumber('WALLET_MIN_BALANCE_USD_CENTS', 100) *
    parseFloat(getOptional('USD_TO_GBP_RATE', '0.79'))
  ), // 79p ≈ $1.00

  // ========================================================================
  // BUSINESS CONFIGURATION (Optional)
  // ========================================================================
  FOUNDER_NAME: getOptional('FOUNDER_NAME'),
  CALENDAR_LINK: getOptional('CALENDAR_LINK'),
  DEMO_URL: getOptional('DEMO_URL'),
  TARGET_PERSONA: getOptional('TARGET_PERSONA'),

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Returns true if running in production
   */
  isProduction(): boolean {
    return this.NODE_ENV === 'production';
  },

  /**
   * Returns true if running in development
   */
  isDevelopment(): boolean {
    return this.NODE_ENV === 'development';
  },

  /**
   * Returns true if running in test environment
   */
  isTest(): boolean {
    return this.NODE_ENV === 'test';
  },

  /**
   * Get CORS options object for Express
   */
  getCorsOptions(): { origin: string; credentials: boolean } {
    return {
      origin: this.CORS_ORIGIN || this.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    };
  },

  /**
   * Validates critical environment variables on startup
   * Throws error if critical variables are missing
   */
  validate(): void {
    const critical = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'TWILIO_ACCOUNT_SID',      // REQUIRED for managed telephony (provisioning Vapi numbers)
      'TWILIO_AUTH_TOKEN',       // REQUIRED for managed telephony (provisioning Vapi numbers)
      'TWILIO_PHONE_NUMBER',     // REQUIRED for managed telephony (provisioning Vapi numbers)
      'VAPI_PRIVATE_KEY',
      // 'GOOGLE_CLIENT_ID',      // No longer required globally
      // 'GOOGLE_CLIENT_SECRET',  // No longer required globally
      // 'GOOGLE_ENCRYPTION_KEY'  // No longer required globally
      'ENCRYPTION_KEY'            // Added as critical
    ];

    const missing = critical.filter(key => !process.env[key] && key !== 'SUPABASE_SERVICE_KEY');

    if (missing.length > 0) {
      console.error('\n' + '='.repeat(80));
      console.error('❌ CRITICAL CONFIGURATION ERROR');
      console.error('='.repeat(80));
      console.error('\nMissing required environment variables:\n');
      missing.forEach(key => {
        console.error(`  ❌ ${key}`);
      });

      // Special message if Twilio is missing
      if (missing.some(key => key.startsWith('TWILIO_'))) {
        console.error('\n' + '='.repeat(80));
        console.error('WHY TWILIO IS REQUIRED:');
        console.error('='.repeat(80));
        console.error('\nVoxanne AI provisions phone numbers for clients.');
        console.error('Twilio credentials are needed to buy/manage numbers via Vapi.');
        console.error('Without Twilio, clients cannot get phone numbers.\n');
      }

      console.error('='.repeat(80));
      console.error('HOW TO FIX:');
      console.error('='.repeat(80));
      console.error('\n1. Go to Render.com → Your Backend Service → Environment');
      console.error('2. Add missing variables from backend/.env file');
      console.error('3. Redeploy the service\n');
      console.error('Reference: See backend/.env.example for configuration guide.\n');
      console.error('='.repeat(80) + '\n');

      throw new Error(
        `Missing critical environment variables: ${missing.join(', ')}`
      );
    }
  }
};

/**
 * Validate configuration on module load
 */
try {
  config.validate();
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

export default config;
