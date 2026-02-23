import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

async function main() {
  console.log('Creating exec_sql RPC function...\n');
  
  // Step 1: Create the exec_sql helper function  
  const createExecSqlSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
    RETURNS VOID AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated, service_role;
  `;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createExecSqlSQL })
    });

    if (response.ok) {
      console.log('✓ Created exec_sql RPC function');
    } else {
      const data = await response.json();
      console.log('Function might already exist or creation failed:', data);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();
