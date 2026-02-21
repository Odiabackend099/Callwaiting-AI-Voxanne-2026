import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

(async () => {
  console.log('🔍 Checking for verified caller ID records...\n');

  // Check all verified caller IDs for this org
  const { data: records, error } = await supabase
    .from('verified_caller_ids')
    .select('*')
    .eq('org_id', ORG_ID);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  if (!records || records.length === 0) {
    console.log('✅ No verified caller ID records found');
    console.log('📋 Database is clean - ready for fresh verification\n');
    process.exit(0);
  }

  console.log(`📋 Found ${records.length} record(s):\n`);
  records.forEach((r, i) => {
    console.log(`Record ${i + 1}:`);
    console.log('  - ID:', r.id);
    console.log('  - Phone:', r.phone_number);
    console.log('  - Status:', r.status);
    console.log('  - Created:', new Date(r.created_at).toLocaleString());
    if (r.verified_at) {
      console.log('  - Verified:', new Date(r.verified_at).toLocaleString());
    }
    console.log('');
  });

  // Delete all records
  console.log('🗑️  Deleting all verified caller ID records...\n');

  const { error: deleteError } = await supabase
    .from('verified_caller_ids')
    .delete()
    .eq('org_id', ORG_ID);

  if (deleteError) {
    console.error('❌ Delete failed:', deleteError.message);
    process.exit(1);
  }

  console.log('✅ All records deleted successfully\n');

  // Verify deletion
  const { data: afterDelete } = await supabase
    .from('verified_caller_ids')
    .select('*')
    .eq('org_id', ORG_ID);

  if (afterDelete && afterDelete.length > 0) {
    console.error('❌ VERIFICATION FAILED: Records still exist');
    process.exit(1);
  }

  console.log('✅ VERIFICATION PASSED: Database is completely clean');
  console.log('');
  console.log('🎉 Ready for fresh verification!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Refresh http://localhost:3000/dashboard/phone-settings');
  console.log('2. Enter your phone number: +2348141995397');
  console.log('3. Click "Start Verification"');
  console.log('4. You should see the 6-digit validation code on screen');
  console.log('5. Answer the call and enter the code on your phone keypad');

})();
