import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

(async () => {
  console.log('🗑️  Deleting verified caller ID record...');
  console.log('Phone: +2348141995397');
  console.log('Org ID: 46cf2995-2bee-44e3-838b-24151486fe4e\n');

  // First check what exists
  const { data: existing, error: checkError } = await supabase
    .from('verified_caller_ids')
    .select('*')
    .eq('phone_number', '+2348141995397')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e');

  if (checkError) {
    console.error('❌ Error checking record:', checkError.message);
    process.exit(1);
  }

  if (!existing || existing.length === 0) {
    console.log('ℹ️  No record found to delete');
    process.exit(0);
  }

  console.log('Found record:');
  console.log('- ID:', existing[0].id);
  console.log('- Status:', existing[0].status);
  console.log('- Created:', existing[0].created_at);
  console.log('');

  // Delete it
  const { error: deleteError } = await supabase
    .from('verified_caller_ids')
    .delete()
    .eq('phone_number', '+2348141995397')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e');

  if (deleteError) {
    console.error('❌ Error deleting:', deleteError.message);
    process.exit(1);
  }

  console.log('✅ Successfully deleted verified caller ID record');
  console.log('');
  console.log('Next steps:');
  console.log('1. Refresh your browser at localhost:3000/dashboard/phone-settings');
  console.log('2. Enter +2348141995397 again');
  console.log('3. Click "Start Verification"');
  console.log('4. You will now see the 6-digit code displayed on screen');
  console.log('5. When Twilio calls, enter that code on your phone keypad');
})();
