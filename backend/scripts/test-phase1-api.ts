/**
 * Phase 1 API Testing Script (with Authentication)
 * Tests backend API endpoints for dashboard stats and knowledge base
 * 
 * Usage: 
 *   cd backend
 *   npx tsx scripts/test-phase1-api.ts
 * 
 * Or provide token via environment variable:
 *   TOKEN="your-token-here" npx tsx scripts/test-phase1-api.ts
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { join } from 'path';

// Load environment variables from backend/.env
// Use __dirname for CommonJS compatibility
const envPath = join(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Also try loading from parent directory (.env.local)
const envLocalPath = join(process.cwd(), '..', '.env.local');
dotenv.config({ path: envLocalPath });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const providedToken = process.env.TOKEN;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Required environment variables:');
  console.error('  - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('');
  console.error('Please set these in backend/.env or .env.local');
  process.exit(1);
}

async function getAuthToken(): Promise<string | null> {
  // If token provided via environment variable, use it
  if (providedToken) {
    console.log('✅ Using token from TOKEN environment variable');
    return providedToken;
  }

  try {
    console.log('🔐 Attempting to get authentication token...');
    console.log('   (To use a specific token, set TOKEN environment variable)');
    console.log('');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Try to get token from existing session (if any user has logged in)
    // Note: This will only work if there's an active session in localStorage/cookies
    // For automated testing, we'd need test credentials
    
    console.log('💡 To get a token for testing:');
    console.log('   1. Open browser console on http://localhost:3000');
    console.log('   2. Run: const { data: { session } } = await window.supabase.auth.getSession();');
    console.log('   3. Copy the token: session?.access_token');
    console.log('   4. Run: TOKEN="your-token-here" npx tsx scripts/test-phase1-api.ts');
    console.log('');
    console.log('   Or use the bash script with token:');
    console.log('   ./scripts/test-phase1-api.sh http://localhost:3001 "your-token-here"');
    console.log('');
    
    return null;
  } catch (error: any) {
    console.error('❌ Error getting auth token:', error.message);
    return null;
  }
}

async function testEndpoint(
  name: string,
  method: string,
  endpoint: string,
  token: string | null,
  body?: any
): Promise<{ success: boolean; status?: number; data?: any; error?: string }> {
  try {
    const url = `${backendUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const responseText = await response.text();
    let responseData: any = null;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return {
      success: response.ok,
      status: response.status,
      data: responseData,
      error: response.ok ? undefined : (responseData?.error || responseData?.message || responseText)
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🧪 Phase 1 API Testing Suite');
  console.log('==========================================');
  console.log(`Backend URL: ${backendUrl}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log('==========================================');
  console.log('');

  // Try to get auth token
  const token = await getAuthToken();

  if (!token) {
    console.log('');
    console.log('⚠️  No authentication token available');
    console.log('   Some tests will fail with 401 Unauthorized (expected)');
    console.log('   This is normal for automated testing without a token');
    console.log('');
    console.log('💡 To test with authentication:');
    console.log('   1. Get token from browser console (see instructions above)');
    console.log('   2. Run: TOKEN="your-token" npx tsx scripts/test-phase1-api.ts');
    console.log('   3. Or use: ./scripts/test-phase1-api.sh <backend-url> <token>');
    console.log('');
  }

  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  // Test 0: Health Check (no auth required)
  console.log('Test 0: GET /health (health check)');
  const healthTest = await testEndpoint('Health Check', 'GET', '/health', null);
  if (healthTest.success) {
    console.log(`✅ Status: ${healthTest.status} OK`);
    console.log('✅ Backend server is healthy');
    passedTests++;
  } else {
    console.log(`❌ Status: ${healthTest.status || 'Error'}`);
    console.log(`   Error: ${healthTest.error || 'Unknown error'}`);
    failedTests++;
  }
  console.log('');

  // Test 1: Dashboard Stats Endpoint (with auth, if available)
  console.log('Test 1: GET /api/calls-dashboard/stats' + (token ? ' (with auth)' : ' (no auth - expected to fail)'));
  const statsTest = await testEndpoint('Dashboard Stats', 'GET', '/api/calls-dashboard/stats', token);
  if (statsTest.success) {
    console.log(`✅ Status: ${statsTest.status} OK`);
    if (statsTest.data) {
      const requiredFields = ['totalCalls', 'inboundCalls', 'outboundCalls', 'completedCalls', 'callsToday', 'avgDuration', 'recentCalls'];
      const missingFields = requiredFields.filter(field => !(field in statsTest.data));
      if (missingFields.length === 0) {
        console.log('✅ Response contains all required fields');
        console.log(`   totalCalls: ${statsTest.data.totalCalls || 0}`);
        console.log(`   inboundCalls: ${statsTest.data.inboundCalls || 0}`);
        console.log(`   outboundCalls: ${statsTest.data.outboundCalls || 0}`);
        console.log(`   completedCalls: ${statsTest.data.completedCalls || 0}`);
        console.log(`   callsToday: ${statsTest.data.callsToday || 0}`);
        console.log(`   avgDuration: ${statsTest.data.avgDuration || 0} seconds`);
        console.log(`   recentCalls: ${statsTest.data.recentCalls?.length || 0} items`);
        passedTests++;
      } else {
        console.log(`❌ Response missing fields: ${missingFields.join(', ')}`);
        console.log('   Response keys:', Object.keys(statsTest.data));
        failedTests++;
      }
    } else {
      console.log('⚠️  Response body is empty');
      failedTests++;
    }
  } else {
    if (statsTest.status === 401) {
      console.log(`⚠️  Status: ${statsTest.status} Unauthorized (Expected without auth token)`);
      console.log('   ⚠️  This is expected if no auth token was provided');
      skippedTests++;
    } else {
      console.log(`❌ Status: ${statsTest.status || 'Error'}`);
      console.log(`   Error: ${statsTest.error || 'Unknown error'}`);
      failedTests++;
    }
  }
  console.log('');

  // Test 2: Knowledge Base GET Endpoint (with auth, if available)
  console.log('Test 2: GET /api/knowledge-base' + (token ? ' (with auth)' : ' (no auth - expected to fail)'));
  const kbGetTest = await testEndpoint('Knowledge Base GET', 'GET', '/api/knowledge-base', token);
  if (kbGetTest.success) {
    console.log(`✅ Status: ${kbGetTest.status} OK`);
    if (kbGetTest.data) {
      if ('items' in kbGetTest.data) {
        console.log('✅ Response contains "items" array');
        console.log(`   Items count: ${Array.isArray(kbGetTest.data.items) ? kbGetTest.data.items.length : 0}`);
        passedTests++;
      } else {
        console.log('❌ Response missing "items" array');
        console.log('   Response keys:', Object.keys(kbGetTest.data));
        failedTests++;
      }
    } else {
      console.log('⚠️  Response body is empty');
      failedTests++;
    }
  } else {
    if (kbGetTest.status === 401) {
      console.log(`⚠️  Status: ${kbGetTest.status} Unauthorized (Expected without auth token)`);
      console.log('   ⚠️  This is expected if no auth token was provided');
      skippedTests++;
    } else {
      console.log(`❌ Status: ${kbGetTest.status || 'Error'}`);
      console.log(`   Error: ${kbGetTest.error || 'Unknown error'}`);
      failedTests++;
    }
  }
  console.log('');

  // Test 3: Knowledge Base POST Endpoint (only if token available)
  if (token) {
    console.log('Test 3: POST /api/knowledge-base (with auth)');
    const testDoc = {
      filename: `test-document-${Date.now()}.md`,
      content: 'This is a test document created by Phase 1 testing script.',
      category: 'general',
      active: true
    };
    
    const kbPostTest = await testEndpoint('Knowledge Base POST', 'POST', '/api/knowledge-base', token, testDoc);
    let createdDocId: string | null = null;
    
    if (kbPostTest.success) {
      console.log(`✅ Status: ${kbPostTest.status} OK`);
      if (kbPostTest.data?.id) {
        console.log('✅ Document created successfully');
        console.log(`   Document ID: ${kbPostTest.data.id}`);
        createdDocId = kbPostTest.data.id;
        passedTests++;
      } else {
        console.log('⚠️  Document created but no ID in response');
        console.log('   Response:', JSON.stringify(kbPostTest.data, null, 2));
        failedTests++;
      }
    } else {
      console.log(`❌ Status: ${kbPostTest.status || 'Error'}`);
      console.log(`   Error: ${kbPostTest.error || 'Unknown error'}`);
      failedTests++;
    }
    console.log('');

    // Test 4: Knowledge Base DELETE Endpoint (only if doc was created)
    if (createdDocId) {
      console.log(`Test 4: DELETE /api/knowledge-base/${createdDocId} (with auth)`);
      const kbDeleteTest = await testEndpoint('Knowledge Base DELETE', 'DELETE', `/api/knowledge-base/${createdDocId}`, token);
      if (kbDeleteTest.success) {
        console.log(`✅ Status: ${kbDeleteTest.status} OK`);
        console.log('✅ Document deleted successfully');
        passedTests++;
      } else {
        console.log(`❌ Status: ${kbDeleteTest.status || 'Error'}`);
        console.log(`   Error: ${kbDeleteTest.error || 'Unknown error'}`);
        failedTests++;
      }
      console.log('');
    } else {
      console.log('Test 4: DELETE /api/knowledge-base/:id (skipped - no document ID)');
      console.log('');
    }
  } else {
    console.log('Test 3: POST /api/knowledge-base (skipped - no auth token)');
    console.log('Test 4: DELETE /api/knowledge-base/:id (skipped - no auth token)');
    console.log('');
    skippedTests += 2;
  }

  // Test 5: Authentication Required (no token) - This should fail (verify security)
  console.log('Test 5: GET /api/calls-dashboard/stats (no auth token - security check)');
  const noAuthTest = await testEndpoint('Dashboard Stats (No Auth)', 'GET', '/api/calls-dashboard/stats', null);
  if (noAuthTest.status === 401) {
    console.log(`✅ Status: ${noAuthTest.status} Unauthorized (Expected)`);
    console.log('✅ Authentication required - security check passed');
    passedTests++;
  } else if (noAuthTest.status === 200) {
    console.log(`⚠️  Status: ${noAuthTest.status} OK (SECURITY WARNING)`);
    console.log('   ⚠️  SECURITY WARNING: Endpoint allows unauthenticated access!');
    console.log('   ⚠️  This should be fixed - endpoint should require authentication');
    failedTests++;
  } else {
    console.log(`⚠️  Status: ${noAuthTest.status || 'Error'} (Expected 401)`);
    console.log(`   Error: ${noAuthTest.error || 'Unknown error'}`);
    failedTests++;
  }
  console.log('');

  // Summary
  console.log('==========================================');
  console.log('📊 Test Summary');
  console.log('==========================================');
  const totalTests = passedTests + failedTests + skippedTests;
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`⏭️  Skipped: ${skippedTests}`);
  if (totalTests > 0) {
    const passRate = Math.round((passedTests / (passedTests + failedTests)) * 100);
    console.log(`Pass Rate: ${passRate}% (excluding skipped)`);
  }
  console.log('');

  // Recommendations
  if (!token) {
    console.log('💡 To test with authentication (recommended):');
    console.log('');
    console.log('   Option 1: Get token from browser console');
    console.log('   1. Open http://localhost:3000/dashboard');
    console.log('   2. Open DevTools Console');
    console.log('   3. Run: const { data: { session } } = await window.supabase.auth.getSession();');
    console.log('   4. Copy token: session?.access_token');
    console.log('   5. Run: TOKEN="your-token" npx tsx scripts/test-phase1-api.ts');
    console.log('');
    console.log('   Option 2: Use the bash script');
    console.log('   ./scripts/test-phase1-api.sh http://localhost:3001 "your-token-here"');
    console.log('');
    console.log('   Option 3: Manual browser testing');
    console.log('   See: TESTING_PHASE1_QUICKSTART.md');
    console.log('');
  }

  if (failedTests === 0) {
    console.log('🎉 All executed tests passed!');
    if (skippedTests > 0) {
      console.log(`⚠️  ${skippedTests} tests skipped (no auth token provided)`);
      console.log('   Run with TOKEN environment variable to execute all tests');
    } else {
      console.log('✅ Phase 1 implementation is working correctly!');
    }
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review errors above.');
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('   1. Verify backend server is running: curl http://localhost:3001/health');
    console.log('   2. Check backend logs for errors');
    console.log('   3. Verify RLS policies are working correctly');
    console.log('   4. Check if endpoints are registered in server.ts');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});
