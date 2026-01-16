import { createClient } from '@supabase/supabase-js';

// Use environment variables or fallback to defaults (expecting .env loaded by setup.ts)
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Integration tests involving Admin API will fail.');
} else {
    console.log('SUPABASE_SERVICE_ROLE_KEY is present. Length:', SUPABASE_SERVICE_ROLE_KEY.length);
}

// Create a Supabase client with the Service Role Key
// This allows bypassing RLS for setup/teardown and admin actions
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * Helper to ensure we are connected
 */
export async function checkDbConnection() {
    const { data, error } = await supabaseAdmin.from('organizations').select('count').limit(1).single();
    if (error) {
        throw new Error(`DB Connection Failed: ${error.message}`);
    }
    return true;
}
