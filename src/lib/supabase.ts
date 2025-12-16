import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (_supabase) return _supabase;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Supabase environment variables are missing. Using placeholders to prevent build crash.');
        // Return a client initialized with placeholders - requests will fail but build might pass
        _supabase = createBrowserClient(
            supabaseUrl || 'https://placeholder.supabase.co',
            supabaseAnonKey || 'placeholder'
        );
        return _supabase;
    }

    _supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    return _supabase;
}

export const supabase = getSupabase();
