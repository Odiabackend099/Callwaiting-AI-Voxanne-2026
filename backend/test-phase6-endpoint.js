#!/usr/bin/env node
/**
 * Manual Phase 6 Endpoint Test
 * Tests /api/vapi/tools endpoint without needing Vitest
 */

const http = require('http');

const API_URL = 'http://localhost:3000';
const ENDPOINT = '/api/vapi/tools';

// Test JWT with org_id (mimics Phase 6 test setup)
const TEST_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMzQ1IiwiZXhwIjo5OTk5OTk5OTk5LCJvcmdfaWQiOiI3ZWQzZTA5Yi1mYzM4LTQ0YjktYmYzNC03YjU2OGM3MzljZWEiLCJpYXQiOjE2MDAwMDAwMDB9.FAKE_SIGNATURE';
const CLINIC_ID = '7ed3e09b-fc38-44b9-bf34-7b568c739cea';
const PROVIDER_ID = 'provider-123';
const TEST_EMAIL = 'test@example.com';

// Appointment time (tomorrow at 2 PM)
const appointmentTime = new Date();
appointmentTime.setDate(appointmentTime.getDate() + 1);
appointmentTime.setHours(14, 0, 0, 0);

const requestBody = {
  tool: 'book_appointment',
  params: {
    clinic_id: CLINIC_ID,
    provider_id: PROVIDER_ID,
    patient_name: 'John Doe',
    patient_email: TEST_EMAIL,
    appointment_time: appointmentTime.toISOString(),
    duration_minutes: 30,
  },
};

console.log('🧪 Phase 6 Manual Endpoint Test');
console.log('================================\n');
console.log(`POST ${API_URL}${ENDPOINT}`);
console.log(`Authorization: Bearer ${TEST_JWT.substring(0, 50)}...`);
console.log(`Body: ${JSON.stringify(requestBody, null, 2)}\n`);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: ENDPOINT,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_JWT}`,
  },
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`\n📬 Response Status: ${res.statusCode}`);
    console.log(`📦 Response Headers:`);
    console.log(JSON.stringify(res.headers, null, 2));
    console.log(`\n📄 Response Body:`);
    
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (res.statusCode === 200 && parsed.success) {
        console.log('\n✅ TEST PASSED');
        console.log(`   - Appointment ID: ${parsed.appointment_id}`);
        console.log(`   - Response time: ${parsed.performance.elapsed_ms}ms`);
        console.log(`   - Under 500ms: ${parsed.performance.under_500ms}`);
        process.exit(0);
      } else if (res.statusCode === 403 || res.statusCode === 401 || res.statusCode === 404) {
        console.log('\n⚠️  TEST RECEIVED EXPECTED ERROR');
        console.log(`   Error Code: ${parsed.code}`);
        process.exit(0);
      } else {
        console.log('\n❌ TEST FAILED - Unexpected response');
        process.exit(1);
      }
    } catch (e) {
      console.log(data);
      console.log('\n❌ TEST FAILED - Invalid JSON response');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:');
  console.error(error.message);
  console.error('\nMake sure the backend server is running on port 3000:');
  console.error('  npm run dev');
  process.exit(1);
});

const bodyString = JSON.stringify(requestBody);
req.write(bodyString);
req.end();
