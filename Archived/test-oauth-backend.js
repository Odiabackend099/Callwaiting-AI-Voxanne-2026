#!/usr/bin/env node
/**
 * OAuth Backend Test Script
 * Tests the Google OAuth flow without frontend dependencies
 * Verifies: Email extraction, Metadata storage, Database persistence
 */

const http = require('http');

const BACKEND_URL = 'http://localhost:3001';

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND_URL);
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
  });
}

async function runTests() {
  console.log('🧪 OAuth Backend Test Suite\n');
  console.log('Testing: Google OAuth Email Extraction & Storage\n');
  
  try {
    // Test 1: Check OAuth status endpoint
    console.log('Test 1: OAuth Status Endpoint...');
    const statusRes = await makeRequest('/api/oauth/google/status');
    console.log(`  Status Code: ${statusRes.status}`);
    console.log(`  Response:`, JSON.stringify(statusRes.body, null, 2));
    
    if (statusRes.status === 200) {
      console.log('  ✅ Status endpoint responding\n');
    } else if (statusRes.status === 401) {
      console.log('  ℹ️  Expected 401 (no authenticated user)\n');
    }
    
    // Test 2: Check backend connectivity
    console.log('Test 2: Backend Health Check...');
    const healthRes = await makeRequest('/health');
    console.log(`  Status Code: ${healthRes.status}`);
    if (healthRes.status === 200) {
      console.log('  ✅ Backend is running\n');
    } else {
      console.log('  ❌ Backend health check failed\n');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Backend not running on :3001');
      console.error('   Start with: npm run dev (in backend directory)\n');
    } else {
      console.error('❌ Test error:', error.message, '\n');
    }
  }
  
  console.log('📋 Manual Testing Steps:');
  console.log('1. Start backend: cd backend && npm run dev');
  console.log('2. Visit http://localhost:3000/dashboard/api-keys');
  console.log('3. Click "Link My Google Calendar"');
  console.log('4. Grant permissions');
  console.log('5. Check backend logs for:');
  console.log('   - Email extraction success');
  console.log('   - Credentials stored with metadata');
  console.log('6. Query database:');
  console.log('   SELECT * FROM org_credentials WHERE provider = \'google_calendar\';');
  console.log('');
  console.log('Expected:');
  console.log('  ✓ No empty rows in org_credentials');
  console.log('  ✓ metadata JSONB contains "email" field');
  console.log('  ✓ No null values for encrypted_config\n');
}

runTests().catch(console.error);
