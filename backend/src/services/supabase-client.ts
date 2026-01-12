/**
 * Supabase Client
 *
 * IMPORTANT: This module uses centralized config management in backend/src/config/index.ts
 * Environment variables are loaded once at application startup, not here.
 *
 * DO NOT add dotenv loading here - it's already handled by server.ts importing config/index.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabaseUrl = (config.SUPABASE_URL || '').trim();
// CRITICAL: Sanitize API key to prevent "Invalid character in header content" errors
// Remove all control characters, newlines, carriage returns, and trim whitespace
const supabaseKey = (
  config.SUPABASE_SERVICE_ROLE_KEY || ''
).trim().replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

function fetchWithTimeout(input: any, init?: any) {
  const timeoutMs = config.SUPABASE_FETCH_TIMEOUT_MS || 8000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const mergedInit: any = {
    ...init,
    signal: controller.signal,
  };

  return fetch(input, mergedInit).finally(() => clearTimeout(timeout));
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: fetchWithTimeout,
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

// Cache-free client for schema introspection-free queries
// Workaround for Supabase JS client schema cache issues
export function createCacheFreeSuperbaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: fetchWithTimeout,
    },
    auth: {
      autoRefreshToken: true,
      persistSession: true
    },
    db: {
      schema: 'public'
    }
  });
}

export default supabase;

