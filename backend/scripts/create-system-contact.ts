import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables from backend/.env
const envPath = path.resolve(__dirname, '../.env');
console.log(`📁 Loading env from: ${envPath}`);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(`⚠️  File not found: ${envPath}`);
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log(`🔍 SUPABASE_URL: ${supabaseUrl.slice(0, 40)}...`);
console.log(`🔍 SUPABASE_SERVICE_ROLE_KEY length: ${supabaseKey.length}`);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')).slice(0, 5));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSystemContact() {
  try {
    console.log('\n🔧 Creating system contact for Vapi bookings...\n');

    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('leads')
      .upsert(
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          org_id: '46cf2995-2bee-44e3-838b-24151486fe4e',
          name: 'Vapi Booking System',
          email: 'system@vapi.booking',
          status: 'active',
          source: 'vapi',
          created_at: now,
          updated_at: now
        },
        { onConflict: 'id' }
      )
      .select();

    if (error) {
      console.error('\n❌ Error creating system contact:');
      console.error('  Message:', error.message);
      console.error('  Code:', error.code);
      if ((error as any).details) console.error('  Details:', (error as any).details);
      process.exit(1);
    }

    console.log('\n✅ System contact created successfully!\n');
    console.log('📊 Contact details:');
    console.log(JSON.stringify(data, null, 2));

    // Verify it exists
    const { data: verify, error: verifyError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      .single();

    if (verifyError) {
      console.error('\n⚠️  Verification failed:', verifyError.message);
    } else {
      console.log('\n✅ Verification successful - contact exists in database');
    }

    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Unexpected error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

createSystemContact();
