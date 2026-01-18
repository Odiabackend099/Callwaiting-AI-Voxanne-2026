/**
 * Script to create system contact for Vapi bookings
 * Run with: npx tsx create-system-contact.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSystemContact() {
  try {
    console.log('🔧 Creating system contact for Vapi bookings...');

    const { data, error } = await supabase
      .from('leads')
      .upsert(
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          org_id: '46cf2995-2bee-44e3-838b-24151486fe4e',
          name: 'Vapi Booking System',
          email: 'system@vapi.booking',
          status: 'active',
          source: 'vapi', // Must match check constraint
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )
      .select();

    if (error) {
      console.error('❌ Error creating system contact:', error.message);
      console.error('Error details:', error);
      process.exit(1);
    }

    console.log('✅ System contact created successfully');
    console.log('📊 Contact details:', data);

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

createSystemContact();
