
import { RedactionService } from '../services/redaction-service';
import { HandoffOrchestrator } from '../services/handoff-orchestrator';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

// Mock Atomic Service call (simulate via RPC directly to avoid importing Service class if not needed, 
// but importing is better for types. Let's use RPC directly for simplicity as per smoke test patterns)

async function runSystemLifecycleTest() {
    console.log('🕵️  SYSTEM LIFECYCLE TEST: "The Anxious Patient"');
    console.log('==================================================');

    // Setup Data
    let leadId: string | null = null;
    let holdId: string | null = null;
    let orgId: string | null = null;
    const testPhone = '+447700900000'; // UK Format
    const testName = 'System Test Patient';

    try {
        // 0. Get Org ID
        const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single();
        if (!orgData) throw new Error('No Organization found.');
        orgId = orgData.id!;
        console.log(`ℹ️  Context: Org ID ${orgId}`);

        // =================================================================
        // STEP 1: INBOUND CALL & REGISTRATION
        // =================================================================
        console.log('\n--- Step 1: Inbound Call & Registration ---');
        // Simulate creating a contact (happens when Vapi answers)
        // Simulate creating a contact (happens when Vapi answers)
        // Check for existing first to avoid UPSERT constraint issues on 'phone, org_id' if index is missing
        const { data: existingLead } = await supabase
            .from('contacts')
            .select('*')
            .eq('org_id', orgId)
            .eq('phone', testPhone)
            .maybeSingle();

        let lead: any;
        if (existingLead) {
            lead = existingLead;
            console.log(`ℹ️  Lead already exists. Using ID: ${lead.id}`);
        } else {
            const { data: newLead, error: createError } = await supabase
                .from('contacts')
                .insert({
                    org_id: orgId,
                    name: testName,
                    phone: testPhone
                    // lead_status: 'new' // Removed to use default and pass check constraint
                })
                .select()
                .single();

            if (createError) throw new Error(`Lead creation failed: ${createError.message}`);
            lead = newLead;
        }

        leadId = lead.id;
        console.log(`✅ Call Started. Lead Identified: ${leadId}`);

        // =================================================================
        // STEP 2: PII SHARING & REDACTION
        // =================================================================
        console.log('\n--- Step 2: Redaction Verification ---');
        const rawTranscript = "My name is John. I have a history of heart issues and I take insulin. My number is 07700 900 123.";
        const redacted = RedactionService.redact(rawTranscript);

        console.log(`> Raw: "${rawTranscript}"`);
        console.log(`> Redacted: "${redacted}"`);

        if (redacted.includes('heart issues') || redacted.includes('07700 900 123')) {
            throw new Error('PII Redaction Failed! Sensitive data leaked.');
        }
        if (!redacted.includes('[REDACTED: MEDICAL]') || !redacted.includes('[REDACTED: PHONE]')) {
            throw new Error('PII Redaction Failed! Markers missing.');
        }
        console.log('✅ PII Successfully Redacted.');

        // =================================================================
        // STEP 3: ATOMIC SLOT CLAIMING
        // =================================================================
        console.log('\n--- Step 3: Atomic Slot Booking ---');
        const slotTime = new Date(Date.now() + 86400000); // 24h from now
        slotTime.setMinutes(0, 0, 0); // Round to hour

        const { data: claimData, error: claimError } = await supabase.rpc('claim_slot_atomic', {
            p_org_id: orgId,
            p_calendar_id: 'cal_system_test',
            p_slot_time: slotTime.toISOString(),
            p_call_sid: 'sys_call_001',
            p_patient_name: testName,
            p_patient_phone: testPhone,
            p_hold_duration_minutes: 5
        });

        if (claimError) throw new Error(`Atomic Claim RPC failed: ${claimError.message}`);
        // RPC returns array, get first item
        const claimResult = claimData && claimData[0] ? claimData[0] : null;

        if (!claimResult || !claimResult.success) {
            throw new Error(`Slot claim refused: ${claimResult?.error || 'Unknown'}`);
        }
        holdId = claimResult.hold_id;
        console.log(`✅ Slot Held Successfully. Hold ID: ${holdId}`);

        // =================================================================
        // STEP 4: INTENT SWITCH (ABANDONMENT)
        // =================================================================
        console.log('\n--- Step 4: Intent Switch (Abandonment) ---');
        // Patient changes mind, asks about Rhinoplasty, then hangs up.
        // We simulate this by releasing the hold manually (as if call ended without confirm)

        const { error: releaseError } = await supabase.rpc('release_hold', {
            p_hold_id: holdId,
            p_org_id: orgId
        });

        if (releaseError) console.warn('Hold release warning (non-fatal):', releaseError);
        console.log('✅ Slot Hold Released (Call Abandoned).');

        // =================================================================
        // STEP 5: CONTEXT HANDOFF
        // =================================================================
        console.log('\n--- Step 5: Context Handoff (Rhinoplasty) ---');
        await HandoffOrchestrator.processCallEnd({
            leadId: leadId!,
            orgId: orgId!,
            callSid: 'sys_call_001',
            patientPhone: testPhone,
            patientName: testName,
            callStatus: 'abandoned',
            mentionedServices: ['rhinoplasty']
        });

        // Verify Task Creation
        const { data: task } = await supabase
            .from('follow_up_tasks')
            .select('*')
            .eq('lead_id', leadId)
            .eq('service_context', 'rhinoplasty')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!task) throw new Error('Handoff Task NOT created.');

        // With our Orchestration fix, high priority tasks should be 'completed' immediately
        if (task.status !== 'completed') {
            throw new Error(`Task created but status is ${task.status} (Expected: completed). SMS trigger failed.`);
        }

        console.log(`✅ Immediate SMS Task Verified (ID: ${task.id})`);

        // =================================================================
        // CLEANUP
        // =================================================================
        console.log('\n--- Cleanup ---');
        if (task) await supabase.from('follow_up_tasks').delete().eq('id', task.id);
        if (holdId) await supabase.from('appointment_holds').delete().eq('id', holdId);
        if (leadId) await supabase.from('contacts').delete().eq('id', leadId);
        console.log('✅ Cleanup Complete.');

        console.log('\n🏆 SYSTEM LIFECYCLE TEST PASSED: ALL PHASES GREEN.');
        process.exit(0);

    } catch (err: any) {
        console.error('\n🔥 SYSTEM TEST FAILED:', err.message);
        process.exit(1);
    }
}

runSystemLifecycleTest();
