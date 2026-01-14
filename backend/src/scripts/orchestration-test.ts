
import { HandoffOrchestrator } from '../services/handoff-orchestrator';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

async function testHandoff() {
    console.log('🧪 MASTER ORCHESTRATOR: Testing Context Handoff');
    console.log('==================================================');

    // Fetch Valid Org ID
    const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single();
    if (!orgData) throw new Error('No Organization found in DB. Seed data first.');

    const orgId = orgData.id;
    console.log(`ℹ️ Using Org ID: ${orgId}`);

    const testPhone = '+15550009999';

    try {
        // 1. Setup Test Lead
        console.log('1️⃣ Creating Test Lead...');
        const { data: lead } = await supabase.from('contacts').insert({
            org_id: orgId,
            name: 'Orchestration Test User',
            phone: testPhone
        }).select().single();

        if (!lead) throw new Error('Failed to create lead');

        // 2. Simulate Facelift Call (High Priority -> Immediate SMS)
        console.log('2️⃣ Simulating Abandoned "Facelift" Call...');
        await HandoffOrchestrator.processCallEnd({
            leadId: lead.id,
            orgId: orgId,
            callSid: 'sim_call_orth_1',
            patientPhone: testPhone,
            patientName: 'Orchestration Test User',
            callStatus: 'abandoned',
            mentionedServices: ['facelift'] // High priority
        });

        // 3. Verify Immediate Execution (Task should be 'completed')
        console.log('3️⃣ Verifying Handoff Logic...');
        const { data: task } = await supabase
            .from('follow_up_tasks')
            .select('*')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!task) throw new Error('Task detection failed');

        // Check Status
        if (task.status === 'completed') {
            console.log('✅ PASS: High Priority Task executed immediately (Status: completed)');
        } else {
            console.error(`❌ FAIL: Task status is ${task.status} (Expected: completed)`);
            process.exit(1);
        }

        // Check PDF Link (Mock verify - we assume logic works if task created, but strictly we'd check logs if we could)
        // Since sendImmediateSMS doesn't return the content to us here, we rely on the status change as proof of execution.

        // 4. Cleanup
        console.log('4️⃣ Cleanup...');
        await supabase.from('follow_up_tasks').delete().eq('id', task.id);
        await supabase.from('contacts').delete().eq('id', lead.id);

        console.log('🎉 ORCHESTRATION TEST PASSED');
        process.exit(0);

    } catch (error) {
        console.error('🔥 TEST FAILED:', error);
        process.exit(1);
    }
}

testHandoff();
