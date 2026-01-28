import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA'
);

async function verify() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║         PRIORITY 10 TABLE VERIFICATION                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const sessions = await supabase.from('auth_sessions').select('*').limit(1);
  const auditLog = await supabase.from('auth_audit_log').select('*').limit(1);

  const sessionsExists = !sessions.error;
  const auditLogExists = !auditLog.error;

  console.log(`auth_sessions:  ${sessionsExists ? '✅ EXISTS' : '❌ ERROR'}`);
  console.log(`auth_audit_log: ${auditLogExists ? '✅ EXISTS' : '❌ ERROR'}\n`);

  const bothExist = sessionsExists && auditLogExists;
  console.log('═'.repeat(63));
  if (bothExist) {
    console.log('✅ PRIORITY 10 MIGRATION SUCCESSFULLY DEPLOYED');
    console.log('   Both auth tables created and accessible');
  }
  console.log('═'.repeat(63) + '\n');
}

verify().catch(console.error);
