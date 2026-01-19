#!/usr/bin/env node

/**
 * Phase 1: Database Cleanup Script (using backend infrastructure)
 * 
 * Usage: node cleanup-db-v2.js
 */

require('dotenv').config({ path: './backend/.env' });
const path = require('path');

// Load backend config
const config = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function cleanup() {
  console.log('🧹 Starting database cleanup...\n');

  try {
    // Delete all appointments
    console.log('Deleting appointments...');
    const { data: appointments, error: aptError } = await supabase
      .from('appointments')
      .select('id');
    
    if (appointments && appointments.length > 0) {
      const ids = appointments.map(a => a.id);
      const { error } = await supabase
        .from('appointments')
        .delete()
        .in('id', ids);
      
      if (error) {
        console.error('   ❌ Error deleting appointments:', error.message);
      } else {
        console.log(`   ✅ Deleted ${ids.length} appointments`);
      }
    } else {
      console.log('   ✅ No appointments to delete');
    }

    // Delete all leads
    console.log('Deleting leads...');
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('id');
    
    if (leads && leads.length > 0) {
      const ids = leads.map(l => l.id);
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', ids);
      
      if (error) {
        console.error('   ❌ Error deleting leads:', error.message);
      } else {
        console.log(`   ✅ Deleted ${ids.length} leads`);
      }
    } else {
      console.log('   ✅ No leads to delete');
    }

    // Delete all contacts
    console.log('Deleting contacts...');
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('id');
    
    if (contacts && contacts.length > 0) {
      const ids = contacts.map(c => c.id);
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', ids);
      
      if (error) {
        console.error('   ❌ Error deleting contacts:', error.message);
      } else {
        console.log(`   ✅ Deleted ${ids.length} contacts`);
      }
    } else {
      console.log('   ✅ No contacts to delete');
    }

    // Verify Sara Org
    console.log('\nVerifying Sara Org...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', '46cf2995-2bee-44e3-838b-24151486fe4e')
      .single();

    if (orgError || !org) {
      console.error('❌ Sara Org not found');
      process.exit(1);
    }

    console.log(`✅ Sara Org found: ${org.name}`);

    // Verify credentials
    console.log('\nChecking credentials...');
    const { data: creds } = await supabase
      .from('organization_api_credentials')
      .select('credential_type')
      .eq('org_id', org.id);

    if (creds && creds.length > 0) {
      console.log(`✅ Found ${creds.length} credentials:`);
      creds.forEach(c => console.log(`   - ${c.credential_type}`));
    } else {
      console.warn('⚠️  No credentials found. You will need to add Twilio and Google Calendar tokens.');
    }

    console.log('\n✅ Database cleanup COMPLETE');
    process.exit(0);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();
