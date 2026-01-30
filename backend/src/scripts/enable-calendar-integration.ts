#!/usr/bin/env ts-node
/**
 * Enable Calendar Integration for Voxanne Demo
 *
 * Sets is_active = true for the Google Calendar integration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VOXANNE_DEMO_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function enableCalendar() {
  console.log('🔧 Enabling Google Calendar integration for Voxanne Demo...\n');

  // Check current status
  const { data: current, error: checkError } = await supabase
    .from('org_credentials')
    .select('*')
    .eq('org_id', VOXANNE_DEMO_ORG_ID)
    .eq('provider', 'google_calendar')
    .single();

  if (checkError) {
    console.error('❌ Error checking current status:', checkError);
    return;
  }

  console.log('Current Status:');
  console.log('  Provider:', current.provider);
  console.log('  Active:', current.is_active);
  console.log('  Email:', current.connected_calendar_email || 'Not set');
  console.log('');

  if (current.is_active) {
    console.log('✅ Calendar integration is already active!');
    return;
  }

  // Enable the integration
  const { error: updateError } = await supabase
    .from('org_credentials')
    .update({
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('org_id', VOXANNE_DEMO_ORG_ID)
    .eq('provider', 'google_calendar');

  if (updateError) {
    console.error('❌ Error enabling calendar:', updateError);
    return;
  }

  console.log('✅ Google Calendar integration enabled successfully!');
  console.log('\nYou can now run the demo feature tests:');
  console.log('  npm run test:voxanne-demo');
}

enableCalendar().catch(console.error);
