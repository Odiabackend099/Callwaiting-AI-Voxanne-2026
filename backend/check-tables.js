const { createClient } = require('@supabase/supabase-js');

const db = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA'
);

(async () => {
  const { data, error } = await db.rpc('get_tables', { schema_name: 'public' });
  if (error) {
    console.log('Tables endpoint:', error);
    // Try listing from profiles table instead
    const { data: profiles } = await db.from('profiles').select('*').limit(1);
    console.log('Profiles table exists:', !!profiles);
  } else {
    console.log('Tables:', data);
  }
})();
