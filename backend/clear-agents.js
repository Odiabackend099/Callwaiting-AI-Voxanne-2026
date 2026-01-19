#!/usr/bin/env node
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('🗑️  Clearing agents for Dev Org...');
    
    const { error: deleteErr } = await supabase
      .from('agents')
      .delete()
      .eq('org_id', 'a0000000-0000-0000-0000-000000000001');
    
    if (deleteErr) {
      console.log('❌ Delete error:', deleteErr.message);
      process.exit(1);
    } else {
      console.log('✅ Agents deleted');
    }
    
    // Verify
    const { data: remaining, error: checkErr } = await supabase
      .from('agents')
      .select('id, role, vapi_assistant_id')
      .eq('org_id', 'a0000000-0000-0000-0000-000000000001');
    
    if (checkErr) {
      console.log('❌ Verify error:', checkErr.message);
      process.exit(1);
    } else {
      console.log(`📊 Remaining agents: ${remaining?.length || 0}`);
      if (remaining?.length === 0) {
        console.log('✅ Database is clean! Ready for fresh test.');
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
