// COPY & PASTE THIS ENTIRE BLOCK INTO BROWSER CONSOLE
// This will test the OAuth status without needing localStorage

(async () => {
  try {
    console.log('🚀 Starting OAuth Status Test...\n');

    // Step 1: Check if we can access the Supabase client
    console.log('Step 1: Checking Supabase availability...');
    if (typeof window !== 'undefined' && !window.supabase) {
      console.error('❌ Supabase not available on window object');
      console.log('   Trying to import dynamically...');
    }

    // Step 2: Try to get session
    console.log('\nStep 2: Attempting to get session...');

    // Try accessing from the module (Next.js might have it)
    let session = null;
    try {
      // This works if supabase is imported at page level
      const response = await fetch('/api/auth/token');
      const tokenData = await response.json();
      console.log('Got token from /api/auth/token:', !!tokenData?.access_token);

      if (tokenData?.access_token) {
        console.log('✅ Access token retrieved from API endpoint');
        session = { access_token: tokenData.access_token };
      }
    } catch (e) {
      console.log('Could not get token from API:', e.message);
    }

    // Step 3: If we have a token, test status endpoint
    if (session?.access_token) {
      console.log('\nStep 3: Testing status endpoint...');

      // We need to get org_id - try from the page or use a wildcard
      const orgIds = [
        '46cf2995-2bee-44e3-838b-24151486fe4e', // Your current org_id from earlier screenshot
        'a0000000-0000-0000-0000-000000000001', // Dev default
      ];

      for (const orgId of orgIds) {
        try {
          const res = await fetch(`http://localhost:3001/api/google-oauth/status/${orgId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          const data = await res.json();
          console.log(`\n  Testing org_id: ${orgId}`);
          console.log(`  Status: ${res.status}`);
          console.log(`  Response:`, data);

          if (data.connected) {
            console.log(`✅ FOUND LINKED CALENDAR! Email: ${data.email}`);
            break;
          }
        } catch (e) {
          console.log(`  Error for ${orgId}:`, e.message);
        }
      }
    } else {
      console.error('❌ Could not obtain access token');
      console.log('\nTroubleshooting steps:');
      console.log('1. Are you logged in? Check bottom-left for username');
      console.log('2. Try: window.location.reload()');
      console.log('3. Log out and log back in');
    }

  } catch (error) {
    console.error('🔴 Test failed:', error);
  }
})();
