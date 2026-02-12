import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

    // Generate a magic link token  
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: TEST_EMAIL
    });

    if (sessionError || !sessionData) {
      console.error('Error generating link:', sessionError);
      process.exit(1);
    }

    const token = sessionData.properties?.email_action_link?.split('token=')[1];
    if (!token) {
      console.error('Could not extract token from link');
      process.exit(1);
    }

    console.log(`\n✅ Generated JWT token for ${TEST_EMAIL}:`);
    console.log(`\nexport TEST_AUTH_TOKEN="${token}"\n`);

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
