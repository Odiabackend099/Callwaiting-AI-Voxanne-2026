// Re-export browser client for backward compatibility.
// All client-side code importing from '@/lib/supabase' will get the new @supabase/ssr client.
export { getSupabase, supabase } from './supabase/client';
