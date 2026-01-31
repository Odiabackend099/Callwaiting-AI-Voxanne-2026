#!/usr/bin/env node
const http = require('http');

// Get test org ID from database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('\n🔍 TESTING DASHBOARD API\n');

  try {
    // Get the first org ID
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (!org) {
      console.log('No organizations found in database');
      return;
    }

    const orgId = org.id;
    console.log(`Testing with org ID: ${orgId}\n`);

    // Get a test JWT token - create a dummy one for dev testing
    // In production, this would come from Auth, but for testing we'll use dev bypass
    const testToken = 'test-token-for-dev';

    // Test the dashboard API endpoint with curl
    const testUrl = `http://localhost:3001/api/calls-dashboard?org_id=${orgId}&page=1&limit=10`;

    console.log(`Testing endpoint: ${testUrl}\n`);

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/calls-dashboard?page=1&limit=10`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-dev-token'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`Response Status: ${res.statusCode}\n`);
        try {
          const parsed = JSON.parse(data);
          if (parsed.calls) {
            console.log(`✅ Successfully retrieved ${parsed.calls.length} calls\n`);
            console.log('Sample call:');
            console.log(JSON.stringify(parsed.calls[0], null, 2));
          } else if (parsed.error) {
            console.log(`❌ Error: ${parsed.error}`);
          } else {
            console.log('Response:');
            console.log(JSON.stringify(parsed, null, 2));
          }
        } catch (e) {
          console.log('Raw response:');
          console.log(data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
    });

    req.end();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
