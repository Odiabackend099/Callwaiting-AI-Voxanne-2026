/**
 * Fix and Verify Script
 * 
 * 1. Force-links the production tool to the assistant (fixing the 400 error)
 * 2. Runs the contract test against the PRODUCTION backend
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY!;
const ASSISTANT_ID = 'f8926b7b-df79-4de5-8e81-a6bd9ad551f2';
const TOOL_ID = 'd7533793-1ad9-4d66-b91a-aeea1e791bec'; // The one pointing to Ngrok
const PRODUCTION_URL = 'https://sobriquetical-zofia-abysmally.ngrok-free.dev';

async function run() {
    console.log('🔧 FIX AND VERIFY\n');

    // STEP 1: Link Tool
    console.log('Step 1: Linking Production Tool...');
    try {
        // Get current config first
        const getRes = await axios.get(
            `https://api.vapi.ai/assistant/${ASSISTANT_ID}`,
            { headers: { 'Authorization': `Bearer ${VAPI_PRIVATE_KEY}` } }
        );

        const currentModel = getRes.data.model;

        // Update with new tool
        const updatePayload = {
            model: {
                ...currentModel,
                toolIds: [TOOL_ID] // Force ONLY this tool
            }
        };

        await axios.patch(
            `https://api.vapi.ai/assistant/${ASSISTANT_ID}`,
            updatePayload,
            { headers: { 'Authorization': `Bearer ${VAPI_PRIVATE_KEY}` } }
        );
        console.log('✅ Tool linked successfully!\n');

    } catch (err: any) {
        console.error('❌ Failed to link tool:', err.response?.data || err.message);
        process.exit(1);
    }

    // STEP 2: Verify Contract
    console.log('Step 2: Verifying Contract against PRODUCTION...');
    console.log(`Target: ${PRODUCTION_URL}\n`);

    try {
        const vapiRequest = {
            message: {
                call: {
                    id: 'test_call_verify_123',
                    orgId: '46cf2995-2bee-44e3-838b-24151486fe4e',
                    customer: { number: '+2348141995397' }
                },
                toolCallList: [{
                    id: 'test_tool_call_verify',
                    type: 'function',
                    function: {
                        name: 'bookClinicAppointment',
                        arguments: JSON.stringify({
                            clientName: 'Verification Patient',
                            clientPhone: '+2348141995397',
                            startTime: '2026-02-20T10:00:00',
                            notes: 'Automated verification'
                        })
                    }
                }]
            }
        };

        const start = Date.now();
        const response = await axios.post(
            `${PRODUCTION_URL}/api/vapi/tools/bookClinicAppointment`,
            vapiRequest,
            { timeout: 20000, validateStatus: () => true }
        );
        const duration = Date.now() - start;

        console.log(`Status: ${response.status}`);
        console.log(`Time: ${duration}ms`);

        if (response.status === 200) {
            console.log('✅ Contract Verified!');
            console.log('Response:', JSON.stringify(response.data, null, 2));
        } else {
            console.log('❌ Contract Failed');
            console.log('Response:', JSON.stringify(response.data, null, 2));
        }

    } catch (err: any) {
        console.error('❌ Verification Error:', err.message);
    }
}

run();
