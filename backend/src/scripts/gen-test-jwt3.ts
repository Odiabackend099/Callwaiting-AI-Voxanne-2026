import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDk1MzEsImV4cCI6MjA3ODkyNTUzMX0.7vQpIIDmxFNHJvQS-H2d8YZ6I3g7B_fvTVNvuNg2dUU';
const TEST_EMAIL = 'test@demo.com';
const TEST_PASSWORD = 'demo123';

async function main() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Sign in with email and password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (error || !data?.session) {
      console.error('Error signing in:', error?.message);
      process.exit(1);
    }

    const token = data.session.access_token;
    
    console.log(`\n✅ Generated JWT token for ${TEST_EMAIL}:`);
    console.log(`\nexport TEST_AUTH_TOKEN="${token}"\n`);

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
