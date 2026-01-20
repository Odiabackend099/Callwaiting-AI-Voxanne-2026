#!/usr/bin/env npx ts-node

/**
 * Operation: Full Circle - Step 1
 * Scorched Earth: Clear appointments & leads for Voxanne org
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' }
});

async function scorchedEarth() {
  console.log('🔥 OPERATION: FULL CIRCLE - STEP 1 - SCORCHED EARTH');
  console.log(`Org ID: ${ORG_ID}\n`);

  try {
    // Count before
    const beforeAppointments = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ORG_ID);

    const beforeLeads = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ORG_ID);

    console.log(`📊 Before deletion:`);
    console.log(`   - Appointments: ${beforeAppointments.count || 0}`);
    console.log(`   - Leads: ${beforeLeads.count || 0}\n`);

    // Delete appointments
    const { error: appointmentError, count: deletedAppointments } = await supabase
      .from('appointments')
      .delete()
      .eq('org_id', ORG_ID);

    if (appointmentError) throw appointmentError;

    // Delete leads
    const { error: leadsError, count: deletedLeads } = await supabase
      .from('leads')
      .delete()
      .eq('org_id', ORG_ID);

    if (leadsError) throw leadsError;

    console.log(`🗑️  Deleted:`);
    console.log(`   - Appointments: ${deletedAppointments}`);
    console.log(`   - Leads: ${deletedLeads}\n`);

    // Verify
    const afterAppointments = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ORG_ID);

    const afterLeads = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ORG_ID);

    console.log(`✅ After deletion:`);
    console.log(`   - Appointments: ${afterAppointments.count || 0}`);
    console.log(`   - Leads: ${afterLeads.count || 0}\n`);

    console.log('✅ STEP 1 COMPLETE: Database purged\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

scorchedEarth();
