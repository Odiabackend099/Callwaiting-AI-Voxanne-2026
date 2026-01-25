/**
 * Vapi Contract Test - The REAL Truth Test
 * 
 * This tests the ACTUAL contract between Vapi and your backend.
 * NOT mocked, NOT isolated - this is what happens on REAL calls.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface TestResult {
    testName: string;
    passed: boolean;
    details: string;
    duration: number;
}

class VapiContractTester {
    private results: TestResult[] = [];
    private vapiApiKey = (process.env.VAPI_PRIVATE_KEY || '').replace(/[\r\n\t\x00-\x1F\x7F]/g, '').replace(/^['"]|['"]$/g, '');
    private assistantId = 'f8926b7b-df79-4de5-8e81-a6bd9ad551f2'; // From our verification
    private backendUrl = process.env.BACKEND_URL || 'https://callwaitingai-backend-sjbi.onrender.com';
    private orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

    async runAllTests() {
        console.log('\n' + '='.repeat(80));
        console.log('🔬 VAPI CONTRACT VERIFICATION (REAL TRUTH TEST)');
        console.log('='.repeat(80) + '\n');

        console.log(`Backend: ${this.backendUrl}`);
        console.log(`Assistant: ${this.assistantId}`);
        console.log(`Org: ${this.orgId}\n`);

        // Test 1: Verify tool definitions are correct
        await this.testToolDefinitions();

        // Test 2: Simulate Vapi's EXACT bookAppointment call
        await this.testBookAppointmentContract();

        // Print final report
        this.printReport();
    }

    async testToolDefinitions() {
        const start = Date.now();
        console.log('TEST 1: Tool Definition Validation\n');

        try {
            // Fetch assistant from Vapi
            const assistantRes = await axios.get(
                `https://api.vapi.ai/assistant/${this.assistantId}`,
                { headers: { 'Authorization': `Bearer ${this.vapiApiKey}` } }
            );

            const toolIds = assistantRes.data.model?.toolIds || [];
            console.log(`  Tools attached: ${toolIds.length}`);

            if (toolIds.length === 0) {
                console.log('  ⚠️  WARNING: No tools attached to assistant');
                console.log('  This is expected if manual linking is pending.');
                console.log('  Skipping tool validation...\n');

                this.results.push({
                    testName: 'Tool Definitions',
                    passed: false,
                    details: 'No tools attached - manual linking required',
                    duration: Date.now() - start
                });
                return;
            }

            // Check each tool
            let allValid = true;
            const toolNames = new Set<string>();

            for (const toolId of toolIds) {
                const toolRes = await axios.get(
                    `https://api.vapi.ai/tool/${toolId}`,
                    { headers: { 'Authorization': `Bearer ${this.vapiApiKey}` } }
                );

                const tool = toolRes.data;
                const name = tool.function?.name;
                const url = tool.server?.url;
                const params = tool.function?.parameters?.properties || {};
                const required = tool.function?.parameters?.required || [];

                toolNames.add(name);

                console.log(`\n  📋 ${name}`);
                console.log(`     URL: ${url}`);
                console.log(`     Params: ${Object.keys(params).join(', ') || 'NONE'}`);
                console.log(`     Required: ${required.join(', ') || 'NONE'}`);

                // Validation checks
                const issues: string[] = [];

                if (!url?.includes('callwaitingai-backend-sjbi.onrender.com') && !url?.includes('ngrok')) {
                    issues.push('Wrong backend URL - should point to production Render or ngrok');
                }

                if (Object.keys(params).length === 0) {
                    issues.push('NO PARAMETERS DEFINED - AI cannot use this tool!');
                }

                if (name === 'bookClinicAppointment') {
                    if (!params.clientName && !params.patientName) issues.push('Missing name parameter');
                    if (!params.startTime && !params.appointmentTime) issues.push('Missing time parameter');
                    if (!params.clientPhone && !params.patientPhone) issues.push('Missing phone parameter');
                }

                if (issues.length > 0) {
                    console.log(`     ❌ ISSUES:`);
                    issues.forEach(issue => console.log(`        - ${issue}`));
                    allValid = false;
                } else {
                    console.log(`     ✅ Valid`);
                }
            }

            this.results.push({
                testName: 'Tool Definitions',
                passed: allValid,
                details: allValid ? 'All tools correctly defined' : 'Tool definition issues found',
                duration: Date.now() - start
            });

        } catch (error: any) {
            console.log(`  ❌ Error: ${error.message}`);
            this.results.push({
                testName: 'Tool Definitions',
                passed: false,
                details: error.message,
                duration: Date.now() - start
            });
        }
    }

    async testBookAppointmentContract() {
        const start = Date.now();
        console.log('\n\nTEST 2: BookAppointment Contract Test\n');

        try {
            // This is EXACTLY what Vapi sends (based on unified-booking-tool.ts)
            const vapiRequest = {
                message: {
                    call: {
                        id: 'test_call_contract_123',
                        orgId: this.orgId,
                        customer: {
                            number: '+2348141995397'
                        }
                    },
                    toolCallList: [{
                        id: 'test_tool_call_789',
                        type: 'function',
                        function: {
                            name: 'bookClinicAppointment',
                            arguments: JSON.stringify({
                                clientName: 'Contract Test Patient',
                                clientEmail: 'test@contracttest.com',
                                clientPhone: '+2348141995397',
                                startTime: '2026-02-19T14:00:00',
                                notes: 'Vapi contract verification test'
                            })
                        }
                    }]
                }
            };

            console.log('  Request payload:');
            console.log(JSON.stringify(vapiRequest, null, 4));

            console.log('\n  Calling backend...');

            const response = await axios.post(
                `${this.backendUrl}/api/vapi/tools/bookClinicAppointment`,
                vapiRequest,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'VapiContractTest/1.0'
                    },
                    timeout: 18000, // Leave 2s buffer before Vapi's 20s timeout
                    validateStatus: () => true // Accept any status
                }
            );

            const duration = Date.now() - start;

            console.log(`\n  Response status: ${response.status}`);
            console.log(`  Response time: ${duration}ms`);
            console.log('  Response body:');
            console.log(JSON.stringify(response.data, null, 4));

            // Validate response
            const issues: string[] = [];

            if (response.status !== 200 && response.status !== 201) {
                issues.push(`Expected 200/201, got ${response.status}`);
                if (response.data?.error) {
                    issues.push(`Error: ${response.data.error}`);
                }
            }

            if (duration > 18000) {
                issues.push(`Response too slow (${duration}ms) - Will timeout on live calls`);
            }

            // Check response format (Vapi expects specific format)
            // Support both "results" array (legacy/webhook) and "result" object (Function Tool)
            let result: any = null;

            if (response.data.results && Array.isArray(response.data.results)) {
                result = response.data.results[0];
            } else if (response.data.result) {
                result = response.data; // The whole body is the result container in some implementations, or data.result is the result
                // Actually our backend returns { toolCallId: ..., result: { ... } }
                // So result is response.data
            } else {
                 issues.push('Response missing "result" or "results" - Vapi requires this format');
            }

            if (result) {
                // If it's the { result: ... } format
                const innerResult = result.result || result;
                
                // Check for success flag inside the result content
                // result.result might be an object or a stringified JSON
                let parsedContent = innerResult;
                 if (typeof innerResult === 'string') {
                    try {
                        parsedContent = JSON.parse(innerResult);
                    } catch (e) {
                        // ignore
                    }
                }

                if (parsedContent.success === true) {
                     console.log('\n  ✅ Booking successful!');
                     if (parsedContent.message) {
                         console.log(`     Message: ${parsedContent.message}`);
                     }
                } else if (parsedContent.success === false) {
                     issues.push(`Booking failed: ${parsedContent.error || 'Unknown error'}`);
                }
            }

            if (issues.length > 0) {
                console.log('\n  ❌ Contract violations:');
                issues.forEach(issue => console.log(`     - ${issue}`));
            } else {
                console.log('\n  ✅ Contract verified');
            }

            this.results.push({
                testName: 'BookAppointment Contract',
                passed: issues.length === 0 && response.status === 200,
                details: issues.length > 0 ? issues.join('; ') : `Success in ${duration}ms`,
                duration
            });

        } catch (error: any) {
            console.log(`\n  ❌ Error: ${error.message}`);

            let details = error.message;
            if (error.code === 'ECONNREFUSED') {
                details = 'Backend not reachable - is the server running?';
            } else if (error.code === 'ETIMEDOUT') {
                details = 'Request timed out - backend too slow or not responding';
            }

            this.results.push({
                testName: 'BookAppointment Contract',
                passed: false,
                details,
                duration: Date.now() - start
            });
        }
    }

    printReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 VERIFICATION REPORT');
        console.log('='.repeat(80) + '\n');

        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;

        this.results.forEach((result, idx) => {
            const icon = result.passed ? '✅' : '❌';

            console.log(`${icon} Test ${idx + 1}: ${result.testName}`);
            console.log(`   ${result.details}`);
            console.log(`   Duration: ${result.duration}ms\n`);
        });

        console.log(`\nSummary: ${passedTests}/${totalTests} tests passed\n`);

        if (failedTests === 0) {
            console.log('🎉 ALL TESTS PASSED - LIVE CALLS WILL WORK!');
            console.log('\nYou can now make a live call with confidence.\n');
            console.log('Expected flow:');
            console.log('  1. User calls your Vapi number');
            console.log('  2. AI asks for appointment details');
            console.log('  3. Tool call hits YOUR production backend');
            console.log('  4. Backend decrypts credentials from SSOT');
            console.log('  5. Backend creates Google Calendar event');
            console.log('  6. Backend sends SMS confirmation');
            console.log('  7. AI confirms booking to caller\n');
        } else {
            console.log('❌ TESTS FAILED - DO NOT MAKE LIVE CALLS YET!');
            console.log('\nFix the issues above before attempting live calls.\n');
            console.log('Common fixes:');
            console.log('  1. Complete manual tool linking in Vapi dashboard');
            console.log('  2. Ensure production backend is running');
            console.log('  3. Verify Google Calendar credentials are encrypted in database');
            console.log('  4. Check org_credentials table has valid data\n');
        }

        process.exit(failedTests > 0 ? 1 : 0);
    }
}

// Validate environment
if (!process.env.VAPI_PRIVATE_KEY) {
    console.error('❌ VAPI_PRIVATE_KEY not set in environment');
    console.error('   Set it in your .env file');
    process.exit(1);
}

// Run the test
const tester = new VapiContractTester();
tester.runAllTests().catch(err => {
    console.error('\n💥 Unexpected error:', err.message);
    process.exit(1);
});
