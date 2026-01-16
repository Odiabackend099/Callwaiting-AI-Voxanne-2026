#!/usr/bin/env node
/**
 * Quick OAuth Status Diagnostic
 * Run: node oauth-diagnostic.js
 * Outputs actual database state and endpoint status
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

async function runDiagnostics() {
  console.log('📊 OAuth Status Diagnostic\n');
  console.log('Time:', new Date().toISOString());
  console.log('---\n');

  try {
    // 1. Check database for credentials
    console.log('1️⃣  Checking Database for Google Calendar Credentials...\n');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data, error } = await supabase
      .from('org_credentials')
      .select('org_id, provider, is_active, metadata')
      .eq('provider', 'google_calendar')
      .limit(10);
    
    if (error) {
      console.error('❌ Database Query Error:');
      console.error('  Code:', error.code);
      console.error('  Message:', error.message);
      console.error('  Hint:', error.hint);
    } else {
      console.log(`✅ Found ${data.length} Google Calendar credential(s)\n`);
      
      if (data.length === 0) {
        console.log('⚠️  WARNING: No Google Calendar credentials in database!');
        console.log('   This means the OAuth flow is not persisting data.');
      } else {
        data.forEach((cred, i) => {
          console.log(`\nCredential #${i + 1}:`);
          console.log(`  Org ID: ${cred.org_id}`);
          console.log(`  Provider: ${cred.provider}`);
          console.log(`  Active: ${cred.is_active}`);
          console.log(`  Email: ${cred.metadata?.email || '(no email in metadata)'}`);
          console.log(`  Metadata Keys: ${Object.keys(cred.metadata || {}).join(', ')}`);
        });
      }
    }
    
    // 2. Check status endpoint
    console.log('\n\n2️⃣  Checking Status Endpoint...\n');
    
    try {
      const response = await fetch('http://localhost:3001/api/google-oauth/status', {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer test-token`
        }
      });
      
      const body = await response.json();
      
      console.log(`Status Code: ${response.status}`);
      console.log(`Response:`, JSON.stringify(body, null, 2));
      
      if (body.connected) {
        console.log('\n✅ Status endpoint shows: CONNECTED');
      } else {
        console.log('\n❌ Status endpoint shows: NOT CONNECTED');
        console.log('   But database might have credentials (check above)');
      }
    } catch (err) {
      console.error('❌ Could not reach status endpoint:');
      console.error('  Error:', err.message);
      console.error('  Backend may not be running on port 3001');
    }
    
    // 3. Summary
    console.log('\n\n📋 Summary:\n');
    
    const hasDbCreds = data && data.length > 0;
    const hasDbEmail = data && data[0]?.metadata?.email;
    
    console.log(`Database has credentials: ${hasDbCreds ? '✅ YES' : '❌ NO'}`);
    console.log(`Metadata has email: ${hasDbEmail ? '✅ YES' : '❌ NO'}`);
    
    if (!hasDbCreds) {
      console.log('\n🔴 ROOT CAUSE: Credentials not being stored in database');
      console.log('   Check backend logs for OAuth callback errors');
      console.log('   Verify SUPABASE_SERVICE_ROLE_KEY is set in backend/.env');
    } else if (!hasDbEmail) {
      console.log('\n🟠 ISSUE: Credentials stored but email not extracted');
      console.log('   Check JWT ID token parsing in google-oauth-service.ts');
    } else {
      console.log('\n🟡 ISSUE: Database has email but status endpoint returns false');
      console.log('   Check status endpoint logic in google-oauth.ts');
      console.log('   Verify RLS policies allow service role access');
    }
    
  } catch (error) {
    console.error('Fatal Error:', error);
  }
}

runDiagnostics();
