
import axios from 'axios';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e'; // Demo Org

if (!WEBHOOK_SECRET) {
    console.error('❌ VAPI_WEBHOOK_SECRET not found in .env.local');
    process.exit(1);
}

// 1. Construct Mock Payload
const callId = `test-extraction-${Date.now()}`;
const payload = {
    message: {
        type: 'end-of-call-report',
        endedReason: 'customer-ended-call',
        cost: 0, // Deliberately 0 to test fallback
        timestamp: Date.now(),
        call: {
            id: callId,
            orgId: ORG_ID, // Direct orgId to robustly find it
            cost: 2.50, // Should extract as 250 cents
            costs: {
                total: 2.50,
                stt: 0.1,
                llm: 2.0,
                tts: 0.4
            },
            messages: [], // Empty as normally happens
            customer: {
                number: '+15550001234'
            },
            analysis: {
                sentiment: 'positive', // Native Vapi sentiment
                summary: 'The customer was happy with the service.',
                structuredData: {
                    sentimentScore: 0.95,
                    outcome: 'Sale Made'
                },
                toolCalls: [
                    { function: { name: 'bookClinicAppointment' } },
                    { function: { name: 'checkAvailability' } }
                ]
            }
        },
        artifact: {
            messages: [
                { role: 'user', content: 'Hello' },
                { role: 'tool_call_result', name: 'lookupCaller', content: '{}' }
            ]
        },
        analysis: {
            sentiment: 'positive',
            summary: 'The customer was happy.',
            structuredData: {
                sentimentScore: 0.95,
                outcome: 'Sale Resolved'
            },
            toolCalls: [
                { function: { name: 'bookClinicAppointment' } }
            ]
        }
    }
};

// Compute Signature
const timestamp = Date.now().toString();
const rawBody = JSON.stringify(payload);
const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

async function verify() {
    console.log(`🚀 Sending Webhook for Call ID: ${callId}`);

    try {
        // 2. Send Webhook
        const res = await axios.post(`${BACKEND_URL}/api/vapi/webhook`, payload, {
            headers: {
                'x-vapi-secret': WEBHOOK_SECRET, // Some implementations use this? No, signature.
                'x-vapi-signature': signature,
                'x-vapi-timestamp': timestamp,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ Webhook Accepted: ${res.status}`);

        // Data propagation might take a moment if async
        await new Promise(r => setTimeout(r, 2000));

        // 3. Verify in Database
        const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: call, error } = await supabase
            .from('calls')
            .select('*')
            .eq('vapi_call_id', callId)
            .single();

        if (error || !call) {
            console.error('❌ Call not found in DB:', error?.message);
            process.exit(1);
        }

        console.log('\n🔍 Verification Results:');

        // Check Cost
        const costMatches = call.cost_cents === 250;
        console.log(`- Cost Cents: ${call.cost_cents} (Expected: 250) -> ${costMatches ? '✅ PASS' : '❌ FAIL'}`);

        // Check Sentiment
        const sentimentLabelMatches = call.sentiment_label === 'positive';
        const sentimentScoreMatches = Math.abs(call.sentiment_score - 0.95) < 0.01;
        console.log(`- Sentiment Label: ${call.sentiment_label} (Expected: positive) -> ${sentimentLabelMatches ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`- Sentiment Score: ${call.sentiment_score} (Expected: 0.95) -> ${sentimentScoreMatches ? '✅ PASS' : '❌ FAIL'}`);

        // Check Tools
        // Expected tools: 'bookClinicAppointment' (from analysis), 'lookupCaller' (from artifact.messages)
        // Note: 'checkAvailability' is in analysis but might be duplicated or missed depending on logic
        const tools = call.tools_used || [];
        const hasBooking = tools.includes('bookClinicAppointment');
        const hasLookup = tools.includes('lookupCaller');
        console.log(`- Tools Used: ${JSON.stringify(tools)}`);
        console.log(`  - Has bookClinicAppointment: ${hasBooking ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`  - Has lookupCaller: ${hasLookup ? '✅ PASS' : '❌ FAIL'}`);

        if (costMatches && sentimentLabelMatches && sentimentScoreMatches && hasBooking && hasLookup) {
            console.log('\n✅ ALL EXTRACTION TESTS PASSED');
            process.exit(0);
        } else {
            console.error('\n❌ SOME CHECKS FAILED');
            process.exit(1);
        }

    } catch (e: any) {
        console.error('❌ Request Failed:', e.message);
        if (e.response) {
            console.error('Response:', e.response.data);
        }
        process.exit(1);
    }
}

verify();
