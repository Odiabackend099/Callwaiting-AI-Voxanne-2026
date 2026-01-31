import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';

const env = dotenv.parse(fs.readFileSync('.env', 'utf-8'));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testApiEndpoints() {
  try {
    console.log('🧪 Testing Analytics Endpoints\n');

    // Get test org
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (!org) {
      console.log('❌ No test organization found');
      return;
    }

    console.log('✅ Test org:', org.id.substring(0, 8));

    // Test with invalid token first to see endpoint structure
    console.log('\n📊 Testing /api/analytics/dashboard-pulse...');
    const pulseRes = await fetch('http://localhost:3001/api/analytics/dashboard-pulse', {
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Content-Type': 'application/json'
      }
    });

    const pulseData = await pulseRes.json();
    console.log('Status:', pulseRes.status);
    console.log('Response:', JSON.stringify(pulseData, null, 2));

    // Now test recent activity
    console.log('\n📋 Testing /api/analytics/recent-activity...');
    const activityRes = await fetch('http://localhost:3001/api/analytics/recent-activity', {
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Content-Type': 'application/json'
      }
    });

    const activityData = await activityRes.json();
    console.log('Status:', activityRes.status);
    console.log('Response:', JSON.stringify(activityData, null, 2));

  } catch (e) {
    console.log('❌ Error:', (e as Error).message);
  }
}

testApiEndpoints();
