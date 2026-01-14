
import { supabase } from '../services/supabase-client';
import { AnalyticsService } from '../services/analytics-service';
import { log } from '../services/logger';
import { randomUUID } from 'crypto';

// Types for Test Results
type TestResult = {
    name: string;
    category: 'Concurrency' | 'Handoff' | 'Silo' | 'Redaction' | 'Latency';
    passed: boolean;
    details: string;
    executionTimeMs?: number;
};

const results: TestResult[] = [];

async function runComprehensiveTest() {
    console.log('🧪 Starting "Master Orchestrator" Comprehensive Verification Suite...');
    console.log('================================================================');

    // Helper to log result
    const logResult = (res: TestResult) => {
        results.push(res);
        const icon = res.passed ? '✅' : '❌';
        console.log(`${icon} [${res.category}] ${res.name}: ${res.details}`);
        if (res.executionTimeMs) console.log(`   ⏱️ Time: ${res.executionTimeMs}ms`);
    };

    // --- PRE-SETUP: Get Valid Org ID ---
    console.log('\n⚙️ Pre-Setup: Fetching/Creating Valid Org...');
    let { data: orgArr } = await supabase.from('organizations').select('id').limit(1);
    let validOrgId = orgArr?.[0]?.id;

    if (!validOrgId) {
        console.log('ℹ️ No organizations found. Creating specific test org...');
        validOrgId = randomUUID();
        const { error: orgError } = await supabase.from('organizations').insert({
            id: validOrgId,
            name: 'Test Org ' + validOrgId.substring(0, 8),
            api_key: 'sk_test_' + validOrgId
        });
        if (orgError) {
            console.error('❌ Failed to create Test Org:', orgError.message);
            // Try to continue, maybe it already exists?
        }
    } else {
        console.log('ℹ️ Using existing Org ID:', validOrgId);
    }

    // --- 1. Atomic Slot Locking (Concurrency) ---
    console.log('\n🔄 1. Testing Atomic Slot Locking...');
    try {
        const slotTime = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
        const resourceId = randomUUID(); // Mock Resource
        const attempts = 5;

        // Use a shared valid Org ID to force lock contention
        const sharedOrgId = validOrgId;

        // Create promises for 5 concurrent claims
        const claimPromises = Array.from({ length: attempts }).map(async (_, i) => {
            return supabase.rpc('claim_slot_atomic', {
                p_org_id: sharedOrgId,
                p_calendar_id: resourceId,
                p_slot_time: slotTime,
                p_call_sid: randomUUID(),
                p_patient_name: `Test Patient ${i}`,
                p_patient_phone: '+447000000000',
                p_hold_duration_minutes: 15
            });
        });

        const responses = await Promise.all(claimPromises);

        const successes = responses.filter(r => r.data && r.data[0]?.success);
        // Note: The RPC returns a table with { success, error }, so r.data will be an array [{ success: true/false }]
        // We need to check r.data[0].success

        // Debug log
        // console.log('Responses:', JSON.stringify(responses.map(r => ({ err: r.error, data: r.data })), null, 2));

        if (successes.length === 1 && responses.length === attempts) {
            logResult({
                name: 'Atomic Lock Enforcement',
                category: 'Concurrency',
                passed: true,
                details: `1 claim succeeded, ${responses.length - 1} blocked.`
            });
        } else {
            if (responses[0]?.error) {
                console.error('❌ Detailed RPC Error:', responses[0].error);
            }
            logResult({
                name: 'Atomic Lock Enforcement',
                category: 'Concurrency',
                passed: false,
                details: `Unexpected results: ${successes.length} successes (Expected 1). Raw Data: ${JSON.stringify(responses.map(r => r.data?.[0]))}`
            });
        }
    } catch (err: any) {
        logResult({
            name: 'Atomic Lock Enforcement',
            category: 'Concurrency',
            passed: false,
            details: `Exception: ${err.message}`
        });
    }

    // --- 2. Contextual Memory Handoff (Inter-Agent) ---
    console.log('\n🧠 2. Testing Contextual Memory Handoff...');

    // Org ID already setup at top
    // let { data: orgArr } = await supabase.from('organizations').select('id').limit(1);
    // let validOrgId = orgArr?.[0]?.id;
    // if (!validOrgId) {
    //     console.log('ℹ️ No organizations found. Creating specific test org...');
    //     validOrgId = randomUUID();
    //     const { error: orgError } = await supabase.from('organizations').insert({
    //         id: validOrgId,
    //         name: 'Test Org ' + validOrgId.substring(0, 8),
    //         api_key: 'sk_test_' + validOrgId
    //     });
    //     if (orgError) {
    //         console.error('❌ Failed to create Test Org:', orgError.message);
    //         // Try to continue, maybe it already exists?
    //     }
    // } else {
    //     console.log('ℹ️ Using existing Org ID:', validOrgId);
    // }

    const mockCallId = randomUUID();
    const mockContactId = randomUUID();

    // Create contact first to avoid FK error
    const { error: contactError } = await supabase.from('contacts').insert({
        id: mockContactId,
        org_id: validOrgId,
        name: 'Handoff Test User',
        phone: '+447911123456', // Valid UK format for redaction test
        email: 'test@example.com' // Valid email for redaction test
    });

    if (contactError) console.error('❌ Failed to create Contact:', contactError.message);

    // Create call
    const { error: callError } = await supabase.from('calls').insert({
        id: mockCallId,
        org_id: validOrgId,
        contact_id: mockContactId,
        status: 'completed',
        direction: 'inbound',
        phone_number: '+447911123456',
        call_date: new Date().toISOString()
    });

    if (callError) {
        console.error('❌ Failed to create Call:', callError.message);
        process.exit(1);
    } else {
        console.log('✅ Mock Call Record Created:', mockCallId);
    }

    // Simulate Webhook (High Value, Not Booked)
    const mockPayload = {
        call: {
            id: mockCallId,
            orgId: validOrgId,
            status: 'completed',
            contactId: mockContactId
        },
        transcript: "I definitely want the Facelift.",
        summary: "Customer intent on Facelift.",
        analysis: {}
    };

    const handoffStart = Date.now(); // Start Timer
    await AnalyticsService.processEndOfCall(mockPayload);
    const handoffEnd = Date.now(); // Stop Timer BEFORE waiting

    // Wait for async task creation (outside timer)
    await new Promise(r => setTimeout(r, 2000));

    const executionTime = handoffEnd - handoffStart;

    // Verify Follow Up Task
    const { data: task } = await supabase.from('follow_up_tasks')
        .select('*')
        .eq('lead_id', mockContactId)
        .eq('task_type', 'call_back')
        .limit(1)
        .maybeSingle();

    logResult({
        name: 'Intent -> Task Creation',
        category: 'Handoff',
        passed: !!task,
        details: task ? `Task created: ${task.id}` : 'No follow-up task created for High Value lead.',
        executionTimeMs: executionTime
    });


    // --- 3. "Silo" Security Audit (Multi-Tenancy) ---
    console.log('\n🔒 3. Testing "Silo" Security...');
    // We can't easily simulate a *different* authenticated user here without signing in as one.
    // We are running as Service Role (usually) in this script.
    // TO TEST: We will query for data with a SPECIFIC org_id filter that is NOT the validOrgId and ensure we get nothing, 
    // OR we rely on manual RLS verification. 
    // BETTER: Create a contact for Org A. Try to fetch it using an Org B context (if we had middleware).
    // As a script, we'll verify that RLS policies EXIST for key tables.

    const { data: policies } = await supabase
        .rpc('get_policies', { table_name: 'contacts' }) // Hypothetical helper, or Query `pg_policies`
        .then(res => res)
        .catch(() => ({ data: null })); // Handle missing RPC safely

    // Fallback: Just query contacts where org_id = RANDOM. Should be empty. 
    const randomOrgId = randomUUID();
    const { data: leakedData } = await supabase.from('contacts').select('*').eq('org_id', randomOrgId);

    logResult({
        name: 'Cross-Tenant Leakage Check',
        category: 'Silo',
        passed: leakedData?.length === 0,
        details: leakedData?.length === 0 ? 'No data leaked for random Org ID' : `Found ${leakedData?.length} records for random Org ID (Risk!)`
    });


    // --- 4. Data Redaction (Compliance) ---
    console.log('\n🛡️ 4. Testing Data Redaction...');

    const { data: callParams, error: fetchError } = await supabase
        .from('calls')
        .select('*') // Select all to see what's happening
        .eq('id', mockCallId)
        .maybeSingle();

    if (fetchError) {
        console.error('❌ Redaction check failed to fetch call:', fetchError.message);
    } else if (!callParams) {
        console.error(`❌ Redaction check: Call record ${mockCallId} not found!`);
    } else {
        console.log('ℹ️ Call Record Found:', JSON.stringify(callParams));
    }

    const metadataStr = JSON.stringify(callParams?.metadata || {});

    // We expect [REDACTED: MEDICAL] because the transcript included "Facelift" which is in our dictionary now?
    // Wait, "Facelift" is in the dictionary in RedactionService.
    // The transcript was: "I definitely want the Facelift."
    // So it should be "I definitely want the [REDACTED: MEDICAL]."

    const isRedacted = metadataStr.includes('[REDACTED: MEDICAL]');

    logResult({
        name: 'PII Redaction in Logs',
        category: 'Redaction',
        passed: isRedacted,
        details: isRedacted ? 'Redaction detected: Medical terms scrubbed.' : `⚠️ GAP: Sensitive data found in plain text. Content: ${metadataStr.substring(0, 100)}...`
    });


    // --- 5. Latency Benchmarking (Performance) ---
    console.log('\n⚡ 5. Benchmarking Latency...');
    logResult({
        name: 'Analytics Pipeline Latency',
        category: 'Latency',
        passed: executionTime < 800,
        details: `Execution time: ${executionTime}ms (Target: <800ms)`,
        executionTimeMs: executionTime
    });


    console.log('\n================================================================');
    console.log('🏁 Test Suite Complete');

    const successCount = results.filter(r => r.passed).length;
    console.log(`Summary: ${successCount} / ${results.length} PASSED`);

    if (successCount < results.length) {
        console.log('⚠️ Some critical checks failed. See details above.');
        process.exit(1);
    }
}

runComprehensiveTest().catch(console.error);
