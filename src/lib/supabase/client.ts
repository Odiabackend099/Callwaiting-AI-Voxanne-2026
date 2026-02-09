import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _supabase: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
    if (_supabase) return _supabase;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    }

    _supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    return _supabase;
}

export const supabase = getSupabase();
