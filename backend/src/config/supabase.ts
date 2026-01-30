/**
 * Shared Supabase Client Configuration
 *
 * Single source of truth for Supabase client initialization.
 * All services should import from this file instead of creating their own clients.
 *
 * Benefits:
 * - Consistent configuration across all services
 * - Single connection pool management
 * - Easier to add middleware/interceptors
 * - Centralized error handling
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { log } from '../services/logger';

// Validate required environment variables at startup
if (!process.env.SUPABASE_URL) {
  throw new Error('FATAL: SUPABASE_URL environment variable is required');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY) {
  throw new Error('FATAL: Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required');
}

/**
 * Service Role Client - Full database access, bypasses RLS
 * Use for: Server-side operations, admin tasks, background jobs
 * WARNING: Never expose this client to frontend code
 */
export const supabaseAdmin: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false, // Server-side doesn't need session persistence
      autoRefreshToken: false, // No user sessions on backend
    },
    db: {
      schema: 'public', // Explicit schema for clarity
    },
    global: {
      headers: {
        'x-client-info': 'voxanne-backend-service', // For monitoring/debugging
      },
    },
  }
);

/**
 * Initialize Supabase connection and verify connectivity
 * Call this on server startup to fail fast if database is unreachable
 */
export async function initializeSupabase(): Promise<void> {
  try {
    // Test connection by querying a simple table
    const { error } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .limit(1);

    if (error) {
      log.error('Supabase', 'Failed to connect to database', { error: error.message });
      throw new Error(`Supabase connection failed: ${error.message}`);
    }

    log.info('Supabase', 'Successfully connected to database', {
      url: process.env.SUPABASE_URL,
    });
  } catch (err: any) {
    log.error('Supabase', 'Database initialization error', { error: err.message });
    throw err;
  }
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use supabaseAdmin instead for clarity
 */
export const supabase = supabaseAdmin;

// Log initialization
log.info('Supabase', 'Supabase client configuration loaded', {
  url: process.env.SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
});
