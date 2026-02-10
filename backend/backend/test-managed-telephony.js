// Quick test for managed telephony feature flag
const fetch = require('node-fetch');

async function testManagedTelephony() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('🧪 Testing Managed Telephony Endpoints...\n');
  
  // Test 1: Health check
  try {
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('✅ Test 1: Health Check');
    console.log(`   Status: ${healthRes.status}`);
    console.log(`   Database: ${healthData.services.database ? 'Connected' : 'Failed'}\n`);
  } catch (err) {
    console.log('❌ Test 1: Health Check Failed');
    console.log(`   Error: ${err.message}\n`);
  }
  
  // Test 2: Status endpoint (should no longer return 403)
  try {
    const statusRes = await fetch(`${baseUrl}/api/managed-telephony/status`, {
      headers: { 'Authorization': 'Bearer dev-mode' }
    });
    console.log('✅ Test 2: Managed Telephony Status Endpoint');
    console.log(`   Status: ${statusRes.status} (Expected: 200, not 403)`);
    if (statusRes.status === 200) {
      const data = await statusRes.json();
      console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}...\n`);
    } else {
      const error = await statusRes.text();
      console.log(`   Error: ${error.substring(0, 200)}\n`);
    }
  } catch (err) {
    console.log('❌ Test 2: Status Endpoint Failed');
    console.log(`   Error: ${err.message}\n`);
  }
  
  // Test 3: Available numbers endpoint
  try {
    const numbersRes = await fetch(`${baseUrl}/api/managed-telephony/available-numbers?country=US&numberType=local&areaCode=415`, {
      headers: { 'Authorization': 'Bearer dev-mode' }
    });
    console.log('✅ Test 3: Available Numbers Endpoint');
    console.log(`   Status: ${numbersRes.status} (Expected: 200, not 500)`);
    if (numbersRes.status === 200) {
      const data = await numbersRes.json();
      console.log(`   Found ${data.numbers?.length || 0} available numbers\n`);
    } else {
      const error = await statusRes.text();
      console.log(`   Error: ${error.substring(0, 200)}\n`);
    }
  } catch (err) {
    console.log('❌ Test 3: Available Numbers Failed');
    console.log(`   Error: ${err.message}\n`);
  }
  
  console.log('✨ Tests Complete!\n');
}

testManagedTelephony().catch(console.error);
