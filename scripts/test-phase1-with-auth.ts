#!/usr/bin/env tsx
/**
 * Phase 1 API Testing Script (with Authentication)
 * Tests backend API endpoints for dashboard stats and knowledge base
 * Automatically handles authentication using Supabase
 * 
 * Usage: 
 *   cd backend
 *   npx tsx ../scripts/test-phase1-with-auth.ts
 * 
 * Or provide token manually:
 *   cd backend
 *   TOKEN="your-token-here" npx tsx ../scripts/test-phase1-with-auth.ts
 */

// @ts-ignore
import dotenv from 'dotenv';
// @ts-ignore
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { join, dirname } from 'path';
// @ts-ignore
import { fileURLToPath } from 'url';

// Load environment variables from backend/.env (if dotenv is available)
try {
  // @ts-ignore
  const __filename = fileURLToPath(import.meta.url);
  // @ts-ignore
  const __dirname = dirname(__filename);
  const envPath = join(__dirname, '..', 'backend', '.env');
  dotenv.config({ path: envPath });
} catch (e) {
  // Dotenv not available, use environment variables directly
  console.warn('⚠️  dotenv not available, using environment variables directly');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Required environment variables:');
  console.error('  - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('');
  console.error('Please set these in backend/.env or .env.local');
  process.exit(1);
}

// Get test credentials from environment or use defaults
const testEmail = process.env.TEST_EMAIL || 'test@example.com';
const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';

async function getAuthToken(): Promise<string | null> {
  try {
    console.log('🔐 Attempting to get authentication token...');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Try to sign in with test credentials
    const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError) {
      console.warn('⚠️  Could not sign in with test credentials:');
      console.warn(`   Email: ${testEmail}`);
      console.warn(`   Error: ${signInError.message}`);
      console.warn('');
      console.warn('💡 To get a token manually:');
      console.warn('   1. Open browser console on http://localhost:3000');
      console.warn('   2. Run: const { data: { session } } = await window.supabase.auth.getSession();');
      console.warn('   3. Copy the token: session?.access_token');
      console.warn('');
      return null;
    }

    if (!session?.session?.access_token) {
      console.error('❌ No access token in session');
      return null;
    }

    console.log('✅ Authentication successful!');
    console.log(`   User ID: ${session.user.id}`);
    console.log(`   Email: ${session.user.email}`);
    return session.session.access_token;
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
    console.log('⚠️  Continuing without authentication token...');
    console.log('   Some tests will fail with 401 Unauthorized (expected)');
    console.log('');
  }

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Dashboard Stats Endpoint (with auth)
  console.log('Test 1: GET /api/calls-dashboard/stats (with auth)');
  const statsTest = await testEndpoint('Dashboard Stats', 'GET', '/api/calls-dashboard/stats', token);
  if (statsTest.success) {
    console.log(`✅ Status: ${statsTest.status} OK`);
    if (statsTest.data) {
      const requiredFields = ['totalCalls', 'inboundCalls', 'outboundCalls', 'completedCalls', 'callsToday', 'avgDuration', 'recentCalls'];
      const missingFields = requiredFields.filter(field => !(field in statsTest.data));
      if (missingFields.length === 0) {
        console.log('✅ Response contains all required fields');
        passedTests++;
      } else {
        console.log(`❌ Response missing fields: ${missingFields.join(', ')}`);
        failedTests++;
      }
      console.log(`   totalCalls: ${statsTest.data.totalCalls || 0}`);
      console.log(`   recentCalls: ${statsTest.data.recentCalls?.length || 0} items`);
    } else {
      console.log('⚠️  Response body is empty');
      failedTests++;
    }
  } else {
    console.log(`❌ Status: ${statsTest.status || 'Error'}`);
    console.log(`   Error: ${statsTest.error || 'Unknown error'}`);
    if (statsTest.status === 401) {
      console.log('   ⚠️  This is expected if no auth token was provided');
    }
    failedTests++;
  }
  console.log('');

  // Test 2: Knowledge Base GET Endpoint (with auth)
  console.log('Test 2: GET /api/knowledge-base (with auth)');
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
        failedTests++;
      }
    } else {
      console.log('⚠️  Response body is empty');
      failedTests++;
    }
  } else {
    console.log(`❌ Status: ${kbGetTest.status || 'Error'}`);
    console.log(`   Error: ${kbGetTest.error || 'Unknown error'}`);
    if (kbGetTest.status === 401) {
      console.log('   ⚠️  This is expected if no auth token was provided');
    }
    failedTests++;
  }
  console.log('');

  // Test 3: Knowledge Base POST Endpoint (with auth)
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
      console.log(`✅ Document created successfully`);
      console.log(`   Document ID: ${kbPostTest.data.id}`);
      createdDocId = kbPostTest.data.id;
      passedTests++;
    } else {
      console.log('⚠️  Document created but no ID in response');
      failedTests++;
    }
  } else {
    console.log(`❌ Status: ${kbPostTest.status || 'Error'}`);
    console.log(`   Error: ${kbPostTest.error || 'Unknown error'}`);
    if (kbPostTest.status === 401) {
      console.log('   ⚠️  This is expected if no auth token was provided');
    }
    failedTests++;
  }
  console.log('');

  // Test 4: Knowledge Base DELETE Endpoint (with auth, if doc was created)
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

  // Test 5: Authentication Required (no token)
  console.log('Test 5: GET /api/calls-dashboard/stats (no auth token)');
  const noAuthTest = await testEndpoint('Dashboard Stats (No Auth)', 'GET', '/api/calls-dashboard/stats', null);
  if (noAuthTest.status === 401) {
    console.log(`✅ Status: ${noAuthTest.status} Unauthorized (Expected)`);
    console.log('✅ Authentication required - security check passed');
    passedTests++;
  } else {
    console.log(`⚠️  Status: ${noAuthTest.status || 'Error'} (Expected 401)`);
    console.log('   ⚠️  This endpoint should require authentication');
    if (noAuthTest.status === 200) {
      console.log('   ⚠️  SECURITY WARNING: Endpoint allows unauthenticated access!');
    }
    failedTests++;
  }
  console.log('');

  // Test 6: Health Check (no auth required)
  console.log('Test 6: GET /health (health check)');
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

  // Summary
  console.log('==========================================');
  console.log('📊 Test Summary');
  console.log('==========================================');
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Pass Rate: ${Math.round((passedTests / (passedTests + failedTests)) * 100)}%`);
  console.log('');

  if (failedTests === 0) {
    console.log('🎉 All tests passed! Phase 1 implementation is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review errors above.');
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('   1. Verify backend server is running: curl http://localhost:3001/health');
    console.log('   2. Check backend logs for errors');
    console.log('   3. Verify user is authenticated (if using manual token)');
    console.log('   4. Verify RLS policies are working correctly');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});
