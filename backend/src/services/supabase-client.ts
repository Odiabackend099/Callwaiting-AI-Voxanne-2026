// Ensure environment variables are loaded
// Load .env explicitly from backend directory using process.cwd()
// @ts-ignore
const path = require('path');
const envPath = path.join(process.cwd(), '.env');
// @ts-ignore
require('dotenv').config({ path: envPath });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
// CRITICAL: Sanitize API key to prevent "Invalid character in header content" errors
// Remove all control characters, newlines, carriage returns, and trim whitespace
const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''
).trim().replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) environment variables');
}

function fetchWithTimeout(input: any, init?: any) {
  const timeoutMs = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS || 8000);
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

export default supabase;
