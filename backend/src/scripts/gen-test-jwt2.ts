import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';
const TEST_EMAIL = 'test@demo.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  try {
    // Get the test org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('email', TEST_EMAIL)
      .single();

    if (orgError || !org) {
      console.error('Failed to find test org:', orgError?.message);
      process.exit(1);
    }

    console.log(`Found test org: ${org.id}`);

    // Get the user ID
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError);
      process.exit(1);
    }

    const user = users?.users?.find((u: any) => u.email === TEST_EMAIL);
    
    if (!user) {
      console.error(`User ${TEST_EMAIL} not found`);
      process.exit(1);
    }

    // Get the user and extract session
    const { data: userData, error: userDataError } = await supabase.auth.admin.getUserById(user.id);
    
    if (userDataError || !userData) {
      console.error('Error getting user data:', userDataError);
      process.exit(1);
    }

    // Create a session to get token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession(user.id);

    if (sessionError || !sessionData?.session) {
      console.error('Error creating session:', sessionError);
      process.exit(1);
    }

    const token = sessionData.session.access_token;
    
    console.log(`\n✅ Generated JWT token for ${TEST_EMAIL}:`);
    console.log(`\nexport TEST_AUTH_TOKEN="${token}"\n`);

  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
