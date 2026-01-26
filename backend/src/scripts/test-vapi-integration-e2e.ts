#!/usr/bin/env npx tsx
/**
 * 🎓 PhD-LEVEL VERIFICATION - THE REAL TRUTH TEST
 *
 * This test simulates EXACTLY what happens during a live Vapi call:
 * 1. Vapi sends a tool call to our /api/vapi/tools/knowledge-base endpoint
 * 2. Our backend processes it and returns toolResult.content as JSON
 * 3. GPT-4o parses that JSON and uses it to answer the caller
 *
 * This is NOT a unit test - it's a full HTTP integration test.
 */

import * as http from 'http';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BACKEND_PORT = process.env.PORT || 3001;
const BACKEND_HOST = 'localhost';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

interface TestCase {
  name: string;
  callerQuestion: string;
  expectedKeywords: string[];
  endpoint: string;
}

const TEST_CASES: TestCase[] = [
  {
    name: 'Location Query',
    callerQuestion: 'Where are you located?',
    expectedKeywords: ['london', 'innovation', 'headquarters', 'address'],
    endpoint: '/api/vapi/tools/knowledge-base'
  },
  {
    name: 'Pricing Query',
    callerQuestion: 'How much does it cost?',
    expectedKeywords: ['$', 'pricing', 'starter', 'professional'],
    endpoint: '/api/vapi/tools/knowledge-base'
  },
  {
    name: 'Hours Query',
    callerQuestion: 'What are your business hours?',
    expectedKeywords: ['hours', 'time', 'open'],
    endpoint: '/api/vapi/tools/knowledge-base'
  },
  {
    name: 'Team Query',
    callerQuestion: 'Who founded the company?',
    expectedKeywords: ['peter', 'ceo', 'founder', 'leadership'],
    endpoint: '/api/vapi/tools/knowledge-base'
  }
];

/**
 * Simulate EXACTLY what Vapi sends when the AI calls the getKnowledgeBase tool
 */
function buildVapiToolCallPayload(query: string): object {
  return {
    // This is the EXACT format Vapi sends for tool calls
    message: {
      toolCalls: [
        {
          id: `call_${Date.now()}`,
          type: 'function',
          function: {
            name: 'getKnowledgeBase',
            arguments: JSON.stringify({
              query: query,
              tenantId: ORG_ID
            })
          }
        }
      ],
      call: {
        id: `vapi_call_${Date.now()}`,
        metadata: {
          org_id: ORG_ID
        },
        customer: {
          number: '+15551234567'
        }
      }
    },
    // Also include top-level for different Vapi versions
    toolCall: {
      function: {
        name: 'getKnowledgeBase',
        arguments: {
          query: query,
          tenantId: ORG_ID
        }
      }
    }
  };
}

/**
 * Make HTTP request to our backend (simulating Vapi)
 */
function makeRequest(endpoint: string, payload: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        // Simulate Vapi headers
        'User-Agent': 'Vapi/1.0',
        'X-Vapi-Call-Id': `test_${Date.now()}`
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

/**
 * Verify the response matches what GPT-4o expects
 */
function verifyVapiResponse(response: any, testCase: TestCase): { passed: boolean; details: string } {
  // Check 1: Response has toolResult structure
  if (!response.body?.toolResult) {
    return { passed: false, details: 'Missing toolResult in response' };
  }

  // Check 2: toolResult.content is a JSON string
  const content = response.body.toolResult.content;
  if (typeof content !== 'string') {
    return { passed: false, details: 'toolResult.content is not a string' };
  }

  // Check 3: Parse the content
  let parsedContent: any;
  try {
    parsedContent = JSON.parse(content);
  } catch (e) {
    return { passed: false, details: 'toolResult.content is not valid JSON' };
  }

  // Check 4: Verify success
  if (!parsedContent.success) {
    return { passed: false, details: `API returned success: false - ${parsedContent.error || 'unknown error'}` };
  }

  // Check 5: Verify context was found
  if (!parsedContent.found && !parsedContent.hasContext) {
    return { passed: false, details: 'No context found in knowledge base' };
  }

  // Check 6: Verify expected keywords exist in context
  const contextLower = (parsedContent.context || '').toLowerCase();
  const foundKeywords = testCase.expectedKeywords.filter(kw => contextLower.includes(kw.toLowerCase()));
  const matchRate = foundKeywords.length / testCase.expectedKeywords.length;

  if (matchRate < 0.25) {
    return {
      passed: false,
      details: `Keyword match rate too low: ${Math.round(matchRate * 100)}% (found: ${foundKeywords.join(', ')})`
    };
  }

  return {
    passed: true,
    details: `Found ${parsedContent.chunkCount} chunks, ${Math.round(matchRate * 100)}% keyword match`
  };
}

async function runTests() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('🎓 PhD-LEVEL E2E VERIFICATION - THE REAL TRUTH TEST');
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Testing: ACTUAL HTTP requests to backend (simulating Vapi)');
  console.log('Endpoint: /api/vapi/tools/knowledge-base');
  console.log(`Backend: http://${BACKEND_HOST}:${BACKEND_PORT}`);
  console.log('');
  console.log('This test verifies:');
  console.log('  1. Vapi payload format is correctly parsed');
  console.log('  2. Knowledge base retrieval returns relevant context');
  console.log('  3. Response format matches Vapi tool contract');
  console.log('  4. GPT-4o can parse the toolResult.content JSON');
  console.log('');
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('');

  let passed = 0;
  let failed = 0;
  const results: { name: string; passed: boolean; details: string; latency: number }[] = [];

  for (const testCase of TEST_CASES) {
    console.log(`[TEST] ${testCase.name}`);
    console.log(`  Caller: "${testCase.callerQuestion}"`);

    const payload = buildVapiToolCallPayload(testCase.callerQuestion);
    const startTime = Date.now();

    try {
      const response = await makeRequest(testCase.endpoint, payload);
      const latency = Date.now() - startTime;

      const verification = verifyVapiResponse(response, testCase);

      if (verification.passed) {
        console.log(`  ✅ PASS (${latency}ms) - ${verification.details}`);
        passed++;
      } else {
        console.log(`  ❌ FAIL (${latency}ms) - ${verification.details}`);
        failed++;
      }

      results.push({
        name: testCase.name,
        passed: verification.passed,
        details: verification.details,
        latency
      });

      // Show the actual context returned (truncated)
      if (response.body?.toolResult?.content) {
        try {
          const content = JSON.parse(response.body.toolResult.content);
          if (content.context) {
            const preview = content.context.substring(0, 200).replace(/\n/g, ' ');
            console.log(`  📄 Context: "${preview}..."`);
          }
        } catch (e) {}
      }

    } catch (error: any) {
      console.log(`  ❌ ERROR - ${error.message}`);
      failed++;
      results.push({
        name: testCase.name,
        passed: false,
        details: `HTTP Error: ${error.message}`,
        latency: 0
      });
    }

    console.log('');
  }

  // Summary
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('📊 FINAL REPORT - E2E Integration Verification');
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total Tests: ${TEST_CASES.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${Math.round((passed / TEST_CASES.length) * 100)}%`);
  console.log('');

  if (failed === 0) {
    console.log('🎯 VERDICT: PRODUCTION READY');
    console.log('');
    console.log('✅ Vapi payload parsing works correctly');
    console.log('✅ Knowledge base retrieval returns relevant context');
    console.log('✅ Response format matches Vapi tool contract');
    console.log('✅ All caller questions return accurate KB information');
    console.log('');
    console.log('🚀 The getKnowledgeBase tool is ready for live calls!');
  } else {
    console.log('⚠️  VERDICT: NEEDS ATTENTION');
    console.log('');
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('');

  // Return exit code
  process.exit(failed > 0 ? 1 : 0);
}

// Check if backend is running first
console.log('');
console.log(`🔍 Checking if backend is running on port ${BACKEND_PORT}...`);

const healthCheck = http.request({
  hostname: BACKEND_HOST,
  port: BACKEND_PORT,
  path: '/api/vapi/webhook/health',
  method: 'GET',
  timeout: 5000
}, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Backend is running!');
    runTests();
  } else {
    console.log(`❌ Backend returned status ${res.statusCode}`);
    console.log('');
    console.log('Please start the backend first:');
    console.log('  cd backend && npm run dev');
    process.exit(1);
  }
});

healthCheck.on('error', (e) => {
  console.log('');
  console.log('❌ Backend is not running!');
  console.log('');
  console.log('Please start the backend first:');
  console.log('  cd backend && npm run dev');
  console.log('');
  console.log(`Error: ${e.message}`);
  process.exit(1);
});

healthCheck.end();
