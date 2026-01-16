/**
 * Send a single test campaign email programmatically.
 *
 * Usage (from backend folder):
 *   npx ts-node scripts/send-test-email.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = process.env.TEST_CAMPAIGN_EMAIL || 'egualesamuel@gmail.com';
  const backendUrl = process.env.BACKEND_URL || 'https://roxanne-vapi.onrender.com';

  console.log(`\n▶ Creating/updating lead for ${email}...`);

  // Check if lead exists
  const { data: existing, error: existingError } = await supabase
    .from('leads')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error('Error checking existing lead:', existingError.message);
    process.exit(1);
  }

  let leadId: string;

  if (existing) {
    leadId = existing.id;
    console.log(`✔ Found existing lead with id=${leadId}`);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('leads')
      .insert({
        org_id: 'a0000000-0000-0000-0000-000000000001',
        email,
        contact_name: 'Samuel',
        clinic_name: 'Test Clinic',
        city: 'London',
        country: 'UK',
        // Use an existing valid source value that passes leads_source_check
        source: 'apify_google_places',
        status: 'new'
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('Error inserting test lead:', insertError?.message);
      process.exit(1);
    }

    leadId = inserted.id;
    console.log(`✔ Inserted new lead with id=${leadId}`);
  }

  console.log('\n▶ Sending campaign email (templateStep=1)...');

  try {
    const response = await axios.post(`${backendUrl}/api/campaigns/send-email`, {
      leadId,
      templateStep: 1,
      extraData: {
        DemoUrl: 'https://callwaitingai.dev/demo',
        CalendarLink: 'https://calendly.com/callwaitingai'
      }
    });

    console.log('✔ API response:', response.data);
    console.log('\n✅ Test email requested successfully. Check your inbox/spam for the message.');
  } catch (err: any) {
    if (err.response) {
      console.error('❌ API error:', err.response.status, err.response.data);
    } else {
      console.error('❌ Request error:', err.message);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
