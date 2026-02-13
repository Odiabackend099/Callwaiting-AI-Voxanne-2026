/**
 * Phase 3: Kill Switch Manual Test Script
 *
 * Simulates status-check requests at intervals to verify the kill switch behavior.
 * Usage: npx tsx src/scripts/test-kill-switch.ts
 */

import axios from 'axios';

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const STATUS_CHECK_URL = `${BASE_URL}/api/vapi/webhook/status-check`;

async function testKillSwitch() {
    console.log('='.repeat(60));
    console.log('🧪 KILL SWITCH TEST SUITE');
    console.log('='.repeat(60));

    // Test 1: No call ID — should return endCall: false
    console.log('\n📋 Test 1: No call ID');
    try {
        const resp1 = await axios.post(STATUS_CHECK_URL, { message: {} });
        console.log(`   Result: endCall = ${resp1.data.endCall}`);
        console.log(`   ✅ ${resp1.data.endCall === false ? 'PASS' : 'FAIL'}`);
    } catch (err: any) {
        console.log(`   ❌ ERROR: ${err.message}`);
    }

    // Test 2: Unknown call ID — should return endCall: false
    console.log('\n📋 Test 2: Unknown call ID');
    try {
        const resp2 = await axios.post(STATUS_CHECK_URL, {
            message: { call: { id: 'nonexistent-call-id' } },
        });
        console.log(`   Result: endCall = ${resp2.data.endCall}`);
        console.log(`   ✅ ${resp2.data.endCall === false ? 'PASS' : 'FAIL'}`);
    } catch (err: any) {
        console.log(`   ❌ ERROR: ${err.message}`);
    }

    // Test 3: Health check
    console.log('\n📋 Test 3: Webhook health');
    try {
        const resp3 = await axios.get(`${BASE_URL}/api/vapi/webhook/health`);
        console.log(`   Status: ${resp3.data.status}`);
        console.log(`   ✅ ${resp3.data.status === 'healthy' ? 'PASS' : 'FAIL'}`);
    } catch (err: any) {
        console.log(`   ❌ ERROR: ${err.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Kill switch test suite complete');
    console.log('='.repeat(60));
}

testKillSwitch().catch(console.error);
